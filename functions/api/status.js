import { createS3Client } from '../utils/s3client.js';
import { checkDiscordConnection } from '../utils/discord.js';
import { checkHuggingFaceConnection, hasHuggingFaceConfig } from '../utils/huggingface.js';
import { checkWebDAVConnection, hasWebDAVConfig } from '../utils/webdav.js';
import { checkGitHubConnection, hasGitHubConfig } from '../utils/github.js';
import { getGuestConfig } from '../utils/guest.js';
import { buildTelegramBotApiUrl, getTelegramApiBase } from '../utils/telegram.js';

const MB = 1024 * 1024;
const DIRECT_UPLOAD_THRESHOLD = 20 * MB;
const CHUNK_UPLOAD_LIMIT = 100 * MB;

function defaultStatusItem({ layer = 'direct' } = {}) {
  return {
    connected: false,
    enabled: false,
    configured: false,
    layer,
    message: 'Not configured',
  };
}

function storageCapability(type, label, layer = 'direct') {
  return {
    type,
    label,
    layer,
    enableHint: 'Configure this storage backend first.',
  };
}

export async function onRequestGet(context) {
  const { env } = context;

  const status = {
    telegram: defaultStatusItem({ layer: 'direct' }),
    kv: { connected: false, enabled: false, configured: false, layer: 'direct', message: 'Not configured' },
    r2: defaultStatusItem({ layer: 'direct' }),
    s3: defaultStatusItem({ layer: 'direct' }),
    discord: defaultStatusItem({ layer: 'direct' }),
    huggingface: defaultStatusItem({ layer: 'direct' }),
    webdav: defaultStatusItem({ layer: 'mounted' }),
    github: defaultStatusItem({ layer: 'direct' }),
    auth: { enabled: false, message: 'Disabled' },
    guestUpload: getGuestConfig(env),
    uploadLimits: getUploadLimits(env),

  Line 305: function getUploadLimits(env = {}) {
  const isCustomApi = env.CUSTOM_BOT_API_URL && env.CUSTOM_BOT_API_URL !== 'https://api.telegram.org';
  const telegramMax = isCustomApi ? 2 * 1024 * 1024 * 1024 : DIRECT_UPLOAD_THRESHOLD;
  return {
    telegram: {
      maxBytes: telegramMax,
      directThreshold: isCustomApi ? telegramMax : DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: false,
      message: isCustomApi 
        ? "Telegram Bot API upload limit is effectively 2GB for custom local bot instances." 
        : 'Telegram web upload on Cloudflare Pages is limited to 20MB. Use R2/S3/WebDAV/GitHub for larger browser uploads, or send the file to Telegram and use webhook return links.',
    },
  });
}

function getUploadLimits() {
  return {
    telegram: {
      maxBytes: DIRECT_UPLOAD_THRESHOLD,
      directThreshold: DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: false,
      message: 'Telegram web upload on Cloudflare Pages is limited to 20MB. Use R2/S3/WebDAV/GitHub for larger browser uploads, or send the file to Telegram and use webhook return links.',
    },
    r2: {
      maxBytes: CHUNK_UPLOAD_LIMIT,
      directThreshold: DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: true,
    },
    s3: {
      maxBytes: CHUNK_UPLOAD_LIMIT,
      directThreshold: DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: true,
    },
    discord: {
      maxBytes: 25 * MB,
      directThreshold: DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: true,
      message: 'Discord upload limit depends on server boost level; 特控tele uses a conservative 25MB default.',
    },
    huggingface: {
      maxBytes: 35 * MB,
      directThreshold: DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: true,
    },
    webdav: {
      maxBytes: CHUNK_UPLOAD_LIMIT,
      directThreshold: DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: true,
    },
    github: {
      maxBytes: CHUNK_UPLOAD_LIMIT,
      directThreshold: DIRECT_UPLOAD_THRESHOLD,
      supportsChunkUpload: true,
    },
  };
}
