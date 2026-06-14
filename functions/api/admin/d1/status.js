/**
 * GET /api/admin/d1/status
 * 返回 D1 数据库状态信息
 */

import { D1Storage } from '../../../lib/d1-storage.js';

export async function onRequest(context) {
  const { env, request } = context;

  // 检查 D1 是否可用
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return new Response(JSON.stringify({
      available: false,
      reason: 'D1 binding not configured',
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const d1 = new D1Storage(env.DB);
    const health = await d1.healthCheck();

    if (!health.ok) {
      return new Response(JSON.stringify({
        available: false,
        health,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取统计数据
    const [fileCount, storageCount] = await Promise.all([
      d1.getFileCount(),
      d1.getStorageConfigCount(),
    ]);

    // 获取 KV 记录数（用于对比）
    let kvFileCount = null;
    if (env.img_url) {
      try {
        const kvList = await env.img_url.list({ prefix: 'file:', limit: 1 });
        kvFileCount = kvList.keys?.length !== undefined ? 'available' : 'unavailable';
      } catch {
        kvFileCount = 'error';
      }
    }

    return new Response(JSON.stringify({
      available: true,
      health,
      stats: {
        fileCount,
        storageCount,
        kvFileCount,
      },
      tables: [
        'files',
        'storage_configs',
        'virtual_folders',
        'sessions',
        'guest_upload_counters',
        'chunk_uploads',
        'app_settings',
      ],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      available: false,
      error: err.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
