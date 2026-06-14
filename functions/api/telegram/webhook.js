import {
  buildTelegramDirectLink,
  createSignedTelegramFileId,
  getTelegramFileFromMessage,
  sendTelegramUploadNotice,
  shouldUseSignedTelegramLinks,
  shouldWriteTelegramMetadata,
} from '../../utils/telegram.js';

async function postTelegramMessage(text, chatId, messageId, env, apiUrlBase) {
  const token = env.TG_Bot_Token;
  const base = env.CUSTOM_BOT_API_URL || 'https://api.telegram.org';
  const url = `${base}/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    parse_mode: 'HTML',
  };
  if (messageId) {
    body.reply_to_message_id = messageId;
    body.allow_sending_without_reply = true;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok && data?.ok, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function handleTextCommand(message, env) {
  const text = message.text || '';
  const cmd = text.toLowerCase().split(' ')[0];
  const chatId = message.chat.id;
  const messageId = message.message_id;

  let replyText = '';

  if (['/help', '/帮助'].includes(cmd)) {
    replyText =
      '🤖 <b>特控图床机器人</b>\n\n' +
      '📤 <b>上传文件：</b>直接发送图片或文件至本机器人/群组\n' +
      '🆘 <b>/help</b>：显示此帮助菜单\n' +
      '📡 <b>/ping</b>：测试机器人与服务器连接\n' +
      '📊 <b>/status</b>：查看当前系统状态\n\n' +
      '💡 提示：上传完成后会自动回复文件直链。';
  } else if (['/ping', '/ping@', '/ping@' + (env.TG_BOT_USERNAME || '').toLowerCase()].includes(cmd) || cmd.startsWith('/ping')) {
    replyText = `⚡️ Pong! 机器人连接正常。\n当前时间: ${new Date().toLocaleString('zh-CN')}`;
  } else if (['/status', '/状态'].includes(cmd)) {
    replyText = '📊 <b>系统状态：</b>\n✅ 服务器运行中\n✅ Webhook 连接正常\n💾 存储后端: ' + (env.TG_STORAGE_TYPE || 'Telegram') + '\n';
  } else {
    return null; // 未知指令，交由后续逻辑处理
  }

  return postTelegramMessage(replyText, chatId, messageId, env);
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  return jsonResponse({
    ok: true,
    message: 'Telegram webhook endpoint is ready.',
    endpoint: url.pathname,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.TG_Bot_Token) {
    return jsonResponse({ ok: false, error: 'TG_Bot_Token is not configured.' }, 500);
  }

  const expectedSecret = env.TG_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const headerSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (headerSecret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'Invalid webhook secret.' }, 401);
    }
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const message = update?.message || update?.channel_post;
  if (!message) {
    return jsonResponse({ ok: true, ignored: 'no-message' });
  }

  const media = getTelegramFileFromMessage(message);
  if (!media) {
    // Check if it's a text command
    if (message.text || message.caption?.startsWith('/')) {
      const result = await handleTextCommand(message, env);
      if (result) return jsonResponse(result);
    }
    return jsonResponse({ ok: true, ignored: 'message-without-file' });
  }

  const useSigned = shouldUseSignedTelegramLinks(env);
  const directId = useSigned
    ? await createSignedTelegramFileId(
        {
          fileId: media.fileId,
          fileExtension: media.fileExtension,
          fileName: media.fileName,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
          messageId: media.messageId,
        },
        env
      )
    : `${media.fileId}.${media.fileExtension}`;

  if (env.img_url) {
    const writeFullMetadata = shouldWriteTelegramMetadata(env);
    await env.img_url.put(`${media.fileId}.${media.fileExtension}`, '', {
      metadata: writeFullMetadata
        ? {
            TimeStamp: Date.now(),
            ListType: 'None',
            Label: 'None',
            liked: false,
            fileName: media.fileName,
            fileSize: media.fileSize,
            storageType: 'telegram',
            telegramFileId: media.fileId,
            telegramMessageId: media.messageId || undefined,
            fromWebhook: true,
            signedLink: useSigned,
          }
        : {
            // Minimal metadata for webhook uploads to appear in file lists
            TimeStamp: Date.now(),
            fileName: media.fileName,
            fileSize: media.fileSize,
            storageType: 'telegram',
            telegramFileId: media.fileId,
            telegramMessageId: media.messageId || undefined,
            fromWebhook: true,
            signedLink: useSigned,
          },
    });
  }

  const directLink = buildTelegramDirectLink(env, directId, new URL(request.url).origin);
  const chatId = message?.chat?.id;
  let reply = {
    attempted: false,
    ok: false,
    skipped: true,
    reason: chatId ? 'not-sent' : 'missing-chat-id',
  };

  if (chatId) {
    const noticeResult = await sendTelegramUploadNotice(
      {
        chatId,
        replyToMessageId: message.message_id,
        directLink,
        fileId: media.fileId,
        messageId: media.messageId || message.message_id,
        fileName: media.fileName,
        fileSize: media.fileSize,
      },
      env
    );
    reply = normalizeReplyResult(noticeResult);
    if (!noticeResult?.ok && !noticeResult?.skipped) {
      console.warn(
        'Webhook reply failed:',
        noticeResult?.data?.description || noticeResult?.error || 'unknown error'
      );
    }
  }

  return jsonResponse({
    ok: true,
    directLink,
    storageType: 'telegram',
    mode: useSigned ? 'signed' : 'kv',
    update: {
      chatId,
      messageId: message.message_id,
      mediaKind: media.kind,
    },
    reply,
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeReplyResult(result) {
  if (!result) {
    return {
      attempted: true,
      ok: false,
      skipped: false,
      reason: 'empty-result',
    };
  }

  return {
    attempted: !result.skipped,
    ok: Boolean(result.ok),
    skipped: Boolean(result.skipped),
    reason: result.reason || result.error || result.data?.description || '',
    status: result.data?.error_code || undefined,
  };
}
