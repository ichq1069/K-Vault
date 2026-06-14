/**
 * 存储策略路由器
 * 根据环境变量自动选择 D1 或 KV 作为主存储，支持双向同步
 */

import { D1Storage } from './d1-storage.js';

/**
 * KV 存储包装器
 */
class KVStorage {
  constructor(kvNamespace) {
    this.kv = kvNamespace;
  }

  async getFileMeta(id) {
    const result = await this.kv.getWithMetadata(id);
    if (!result?.metadata) return null;
    return { id, ...result.metadata, extra: result.metadata.extra || {} };
  }

  async setFileMeta(id, meta) {
    const { extra, ...rest } = meta;
    await this.kv.put(id, '', { metadata: { ...rest, ...extra } });
  }

  async deleteFileMeta(id) {
    await this.kv.delete(id);
  }

  async listFiles({ cursor, limit = 50, folderPath = '' } = {}) {
    const options = { limit };
    if (cursor) options.cursor = cursor;
    if (folderPath) options.prefix = folderPath;

    const result = await this.kv.list(options);
    const files = [];

    for (const key of result.keys) {
      const meta = await this.kv.getWithMetadata(key.name);
      if (meta?.metadata) {
        files.push({ id: key.name, ...meta.metadata });
      }
    }

    return {
      files,
      cursor: result.list_complete ? null : result.cursor,
    };
  }

  async healthCheck() {
    try {
      await this.kv.get('health_check');
      return { ok: true, type: 'kv' };
    } catch {
      return { ok: false, type: 'kv' };
    }
  }

  async listKeys({ prefix = 'file:', limit = 1000 } = {}) {
    return await this.kv.list({ prefix, limit });
  }

  async get(key, type = 'text') {
    return await this.kv.get(key, type);
  }

  async delete(key) {
    await this.kv.delete(key);
  }
}

/**
 * 创建存储路由器
 * @param {object} env - Cloudflare 环境变量
 * @returns {{primary: string, instance: object, fallback: object|null, syncMode: string}}
 */
export function createStorageRouter(env) {
  const d1Available = env.DB && typeof env.DB.prepare === 'function';
  const kvAvailable = env.img_url && typeof env.img_url.get === 'function';
  const syncMode = env.D1_SYNC_MODE || 'bidirectional';

  if (d1Available) {
    return {
      primary: 'd1',
      instance: new D1Storage(env.DB),
      fallback: kvAvailable ? new KVStorage(env.img_url) : null,
      syncMode,
    };
  }

  return {
    primary: 'kv',
    instance: kvAvailable ? new KVStorage(env.img_url) : null,
    fallback: null,
    syncMode: 'none',
  };
}

/**
 * 执行存储操作，支持自动同步和故障转移
 * @param {object} router - 存储路由器
 * @param {string} operation - 操作名称（getFileMeta/setFileMeta/deleteFileMeta/listFiles）
 * @param  {...any} args - 操作参数
 * @returns {Promise<any>}
 */
export async function storageOperation(router, operation, ...args) {
  if (!router?.instance) {
    throw new Error('No storage backend available');
  }

  try {
    const result = await router.instance[operation](...args);

    // 双向同步：写入主存储后异步写入备份
    if (router.syncMode === 'bidirectional' && router.fallback) {
      if (operation === 'setFileMeta') {
        router.fallback.setFileMeta(...args).catch((err) => {
          console.warn('[D1-KV Sync] Failed to sync to fallback:', err.message);
        });
      } else if (operation === 'deleteFileMeta') {
        router.fallback.deleteFileMeta(...args).catch((err) => {
          console.warn('[D1-KV Sync] Failed to delete from fallback:', err.message);
        });
      }
    }

    return result;
  } catch (err) {
    // 故障转移：主存储失败时使用备份
    if (router.fallback) {
      console.warn(`[Storage Router] Primary failed, falling back to ${router.fallback instanceof KVStorage ? 'KV' : 'D1'}:`, err.message);
      try {
        const result = await router.fallback[operation](...args);

        // 反向同步（从备份同步到主存储）
        if (router.syncMode === 'bidirectional' && operation === 'setFileMeta') {
          router.instance.setFileMeta(...args).catch((syncErr) => {
            console.warn('[D1-KV Sync] Failed to sync back to primary:', syncErr.message);
          });
        }

        return result;
      } catch (fallbackErr) {
        throw new Error(`Both storage backends failed: ${fallbackErr.message}`);
      }
    }
    throw err;
  }
}

/**
 * 获取存储状态信息
 * @param {object} router - 存储路由器
 * @returns {Promise<object>}
 */
export async function getStorageStatus(router) {
  const status = {
    primary: router.primary,
    syncMode: router.syncMode,
    primaryHealth: await router.instance.healthCheck(),
    fallbackHealth: null,
  };

  if (router.fallback) {
    status.fallbackHealth = await router.fallback.healthCheck();
  }

  return status;
}
