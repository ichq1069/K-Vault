/**
 * KV 到 D1 数据迁移服务
 */

export class KVToD1Migration {
  /**
   * @param {KVNamespace} kv - Cloudflare KV namespace
   * @param {D1Storage} d1 - D1 存储实例
   */
  constructor(kv, d1) {
    this.kv = kv;
    this.d1 = d1;
  }

  /**
   * 执行迁移
   * @param {object} options
   * @param {number} [options.batchSize=50] - 每批处理数量
   * @param {string} [options.resumeCursor] - 续传游标
   * @returns {Promise<{totalMigrated: number, totalSkipped: number, totalFailed: number, completed: boolean}>}
   */
  async migrate({ batchSize = 50, resumeCursor = null } = {}) {
    let cursor = resumeCursor;
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // 迁移 file: 前缀的数据
    while (true) {
      const { keys, list_complete, cursor: nextCursor } = await this.kv.list({
        prefix: 'file:',
        limit: batchSize,
        cursor: cursor || undefined,
      });

      for (const key of keys) {
        try {
          const meta = await this.kv.get(key.name, 'json');
          if (!meta) {
            totalSkipped++;
            continue;
          }

          const fileId = key.name.replace('file:', '');
          await this.d1.setFileMeta(fileId, meta);
          totalMigrated++;
        } catch (err) {
          console.error(`[Migration] Failed for ${key.name}:`, err);
          totalFailed++;
        }
      }

      cursor = nextCursor;
      if (!list_complete || !cursor) break;
    }

    // 迁移 paste: 前缀的数据
    try {
      const pasteKeys = await this.kv.list({ prefix: 'paste:', limit: 1000 });
      for (const key of pasteKeys.keys || []) {
        try {
          const content = await this.kv.get(key.name, 'text');
          if (content) {
            const pasteId = key.name.replace('paste:', '');
            await this.d1.db.prepare(
              "INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)"
            ).bind(
              `paste:${pasteId}`,
              JSON.stringify({ content, createdAt: Date.now() }),
              Date.now()
            ).run();
            totalMigrated++;
          }
        } catch {
          totalFailed++;
        }
      }
    } catch (err) {
      console.warn('[Migration] Failed to migrate paste data:', err);
    }

    // 迁移 folder: 前缀的数据
    try {
      const folderKeys = await this.kv.list({ prefix: 'folder:', limit: 1000 });
      for (const key of folderKeys.keys || []) {
        try {
          const meta = await this.kv.get(key.name, 'json');
          if (meta) {
            const folderPath = key.name.replace('folder:', '');
            await this.d1.db.prepare(
              "INSERT OR REPLACE INTO virtual_folders (path, parent_path, file_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(
              folderPath,
              meta.parentPath || '',
              meta.fileCount || 0,
              meta.createdAt || Date.now(),
              meta.updatedAt || Date.now()
            ).run();
            totalMigrated++;
          }
        } catch {
          totalFailed++;
        }
      }
    } catch (err) {
      console.warn('[Migration] Failed to migrate folder data:', err);
    }

    return {
      totalMigrated,
      totalSkipped,
      totalFailed,
      completed: true,
    };
  }

  /**
   * 同步差异比对
   * @param {object} options
   * @param {string} [options.direction='kv-to-d1'] - 同步方向
   * @returns {Promise<{missing: Array, outdated: Array, kvCount: number, d1Count: number}>}
   */
  async syncDiff({ direction = 'kv-to-d1' } = {}) {
    // 获取 KV 中的文件列表
    const kvFiles = await this.kv.list({ prefix: 'file:', limit: 1000 });
    
    // 获取 D1 中的文件列表
    const d1Files = await this.d1.db.prepare("SELECT id, updated_at FROM files").all();
    const d1Map = new Map(d1Files.results.map(r => [r.id, r.updated_at]));

    const missing = [];
    const outdated = [];

    for (const key of kvFiles.keys || []) {
      const fileId = key.name.replace('file:', '');
      
      if (!d1Map.has(fileId)) {
        // D1 中缺失
        missing.push(fileId);
      } else if (key.metadata?.updatedAt && d1Map.get(fileId) < key.metadata.updatedAt) {
        // D1 中的数据过期
        outdated.push(fileId);
      }
    }

    return {
      missing,
      outdated,
      kvCount: kvFiles.keys?.length || 0,
      d1Count: d1Files.results?.length || 0,
    };
  }

  /**
   * 执行同步修复
   * @param {object} options
   * @param {string} [options.direction='kv-to-d1'] - 同步方向（kv-to-d1 或 d1-to-kv）
   * @param {Array} [options.fileIds] - 指定文件 ID 列表，为空则同步全部
   * @returns {Promise<{synced: number, failed: number}>}
   */
  async syncFix({ direction = 'kv-to-d1', fileIds = null } = {}) {
    let synced = 0;
    let failed = 0;

    if (direction === 'kv-to-d1') {
      // 从 KV 同步到 D1
      if (fileIds) {
        for (const fileId of fileIds) {
          try {
            const key = `file:${fileId}`;
            const meta = await this.kv.get(key, 'json');
            if (meta) {
              await this.d1.setFileMeta(fileId, meta);
              synced++;
            }
          } catch {
            failed++;
          }
        }
      } else {
        // 同步全部
        const diff = await this.syncDiff();
        for (const fileId of [...diff.missing, ...diff.outdated]) {
          try {
            const key = `file:${fileId}`;
            const meta = await this.kv.get(key, 'json');
            if (meta) {
              await this.d1.setFileMeta(fileId, meta);
              synced++;
            }
          } catch {
            failed++;
          }
        }
      }
    } else if (direction === 'd1-to-kv') {
      // 从 D1 同步到 KV
      const d1Files = await this.d1.db.prepare("SELECT * FROM files").all();
      
      for (const row of d1Files.results || []) {
        try {
          const fileId = row.id;
          if (fileIds && !fileIds.includes(fileId)) continue;

          const meta = this.d1._rowToMeta(row);
          await this.kv.put(`file:${fileId}`, '', { metadata: meta });
          synced++;
        } catch {
          failed++;
        }
      }
    }

    return { synced, failed };
  }
}
