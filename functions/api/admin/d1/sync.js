/**
 * GET /api/admin/d1/sync - 比对 KV 和 D1 数据差异
 * POST /api/admin/d1/sync - 执行同步修复
 */

import { D1Storage } from '../../../lib/d1-storage.js';
import { KVToD1Migration } from '../../../lib/kv-to-d1-migration.js';

export async function onRequest(context) {
  const { env, request } = context;

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
    const d1 = new D1Storage(env.DB);
    const migration = new KVToD1Migration(env.img_url, d1);

    // GET 请求：返回差异报告
    if (request.method === 'GET') {
      const diff = await migration.syncDiff();
      return new Response(JSON.stringify(diff), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST 请求：执行同步修复
    if (request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        // 允许空请求体
      }

      const { direction = 'kv-to-d1', fileIds = null } = body;
      const result = await migration.syncFix({ direction, fileIds });

      return new Response(JSON.stringify({
        success: true,
        ...result,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
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
