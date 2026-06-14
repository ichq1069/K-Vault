/**
 * POST /api/admin/d1/migrate
 * 触发 KV 到 D1 的数据迁移
 */

import { D1Storage } from '../../../lib/d1-storage.js';
import { KVToD1Migration } from '../../../lib/kv-to-d1-migration.js';

export async function onRequestPost(context) {
  const { env, request } = context;

  // 验证 D1 和 KV 都可用
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return new Response(JSON.stringify({ error: 'D1 binding not configured' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.img_url || typeof env.img_url.get !== 'function') {
    return new Response(JSON.stringify({ error: 'KV binding img_url not configured' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 解析请求参数
    let body = {};
    try {
      body = await request.json();
    } catch {
      // 允许空请求体
    }

    const { batchSize = 50, resumeCursor = null } = body;

    // 执行迁移
    const d1 = new D1Storage(env.DB);
    const migration = new KVToD1Migration(env.img_url, d1);
    const result = await migration.migrate({ batchSize, resumeCursor });

    return new Response(JSON.stringify({
      success: true,
      ...result,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
