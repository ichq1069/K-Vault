/**
 * D1 数据库存储适配器
 * 实现与 KVStorage 相同的接口，用于 Cloudflare Pages 模式
 */

import { initD1Schema } from './d1-schema.js';

export class D1Storage {
  /**
   * @param {D1Database} db - Cloudflare D1 数据库实例
   */
  constructor(db) {
    this.db = db;
    this._initialized = false;
  }

  /**
   * 确保表结构已初始化
   */
  async ensureInitialized() {
    if (!this._initialized) {
      await initD1Schema(this.db);
      this._initialized = true;
    }
  }

  /**
   * 获取文件元数据
   * @param {string} id - 文件 ID
   * @returns {Promise<object|null>} 文件元数据或 null
   */
  async getFileMeta(id) {
    await this.ensureInitialized();
    const { results } = await this.db.prepare(
      "SELECT * FROM files WHERE id = ?"
    ).bind(id).all();
    
    if (!results || results.length === 0) return null;
    
    const row = results[0];
    return this._rowToMeta(row);
  }

  /**
   * 设置文件元数据（插入或更新）
   * @param {string} id - 文件 ID
   * @param {object} meta - 文件元数据
   */
  async setFileMeta(id, meta) {
    await this.ensureInitialized();
    
    const now = Date.now();
    const createdAt = meta.created_at || meta.createdAt || now;
    const updatedAt = meta.updated_at || meta.updatedAt || now;
    
    await this.db.prepare(
      `INSERT INTO files (
        id, storage_config_id, storage_type, storage_key, file_name,
        file_size, mime_type, folder_path, list_type, label, liked,
        extra_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        storage_config_id = ?, storage_type = ?, storage_key = ?,
        file_name = ?, file_size = ?, mime_type = ?, folder_path = ?,
        list_type = ?, label = ?, liked = ?, extra_json = ?,
        updated_at = ?`
    ).bind(
      id,
      meta.storage_config_id || meta.storageConfigId || null,
      meta.storage_type || meta.storageType || 'telegram',
      meta.storage_key || meta.storageKey || id,
      meta.file_name || meta.fileName || id,
      meta.file_size || meta.fileSize || 0,
      meta.mime_type || meta.mimeType || null,
      meta.folder_path || meta.folderPath || '/',
      meta.list_type || meta.ListType || 'file',
      meta.label || meta.Label || null,
      meta.liked ? 1 : 0,
      JSON.stringify(meta.extra || {}),
      createdAt,
      updatedAt,
      // UPDATE 参数
      meta.storage_config_id || meta.storageConfigId || null,
      meta.storage_type || meta.storageType || 'telegram',
      meta.storage_key || meta.storageKey || id,
      meta.file_name || meta.fileName || id,
      meta.file_size || meta.fileSize || 0,
      meta.mime_type || meta.mimeType || null,
      meta.folder_path || meta.folderPath || '/',
      meta.list_type || meta.ListType || 'file',
      meta.label || meta.Label || null,
      meta.liked ? 1 : 0,
      JSON.stringify(meta.extra || {}),
      updatedAt
    ).run();
  }

  /**
   * 删除文件元数据
   * @param {string} id - 文件 ID
   */
  async deleteFileMeta(id) {
    await this.ensureInitialized();
    await this.db.prepare("DELETE FROM files WHERE id = ?").bind(id).run();
  }

  /**
   * 列出文件
   * @param {object} options - 查询选项
   * @param {number} [options.cursor] - 游标（时间戳）
   * @param {number} [options.limit=50] - 每页数量
   * @param {string} [options.folderPath] - 文件夹路径
   * @returns {Promise<{files: Array, cursor: number|null}>}
   */
  async listFiles({ cursor, limit = 50, folderPath = '' } = {}) {
    await this.ensureInitialized();
    
    let sql = "SELECT * FROM files";
    const params = [];
    
    if (folderPath) {
      sql += " WHERE folder_path = ? OR folder_path LIKE ?";
      params.push(folderPath, `${folderPath}%`);
    }
    
    if (cursor) {
      sql += folderPath ? " AND" : " WHERE";
      sql += " created_at < ?";
      params.push(Number(cursor));
    }
    
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    
    const { results } = await this.db.prepare(sql).bind(...params).all();
    
    const files = (results || []).map(row => this._rowToMeta(row));
    
    return {
      files,
      cursor: files.length === limit ? files[files.length - 1].created_at : null,
    };
  }

  /**
   * 健康检查
   * @returns {Promise<{ok: boolean, type: string}>}
   */
  async healthCheck() {
    try {
      await this.ensureInitialized();
      await this.db.prepare("SELECT 1").run();
      return { ok: true, type: 'd1' };
    } catch (err) {
      console.error('D1 health check failed:', err);
      return { ok: false, type: 'd1', error: err.message };
    }
  }

  /**
   * 获取所有文件数量
   * @returns {Promise<number>}
   */
  async getFileCount() {
    await this.ensureInitialized();
    const { count } = await this.db.prepare("SELECT COUNT(*) as count FROM files").first();
    return count;
  }

  /**
   * 获取存储配置数量
   * @returns {Promise<number>}
   */
  async getStorageConfigCount() {
    await this.ensureInitialized();
    const { count } = await this.db.prepare("SELECT COUNT(*) as count FROM storage_configs").first();
    return count;
  }

  /**
   * 将数据库行转换为元数据格式（兼容 KV 格式）
   * @private
   */
  _rowToMeta(row) {
    if (!row) return null;
    
    let extra = {};
    try {
      extra = row.extra_json ? JSON.parse(row.extra_json) : {};
    } catch {
      extra = {};
    }
    
    return {
      id: row.id,
      storage_config_id: row.storage_config_id,
      storageConfigId: row.storage_config_id,
      storage_type: row.storage_type,
      storageType: row.storage_type,
      storage_key: row.storage_key,
      storageKey: row.storage_key,
      file_name: row.file_name,
      fileName: row.file_name,
      file_size: row.file_size,
      fileSize: row.file_size,
      mime_type: row.mime_type,
      mimeType: row.mime_type,
      folder_path: row.folder_path,
      folderPath: row.folder_path,
      list_type: row.list_type,
      ListType: row.list_type,
      label: row.label,
      Label: row.label,
      liked: Boolean(row.liked),
      extra,
      created_at: row.created_at,
      createdAt: row.created_at,
      updated_at: row.updated_at,
      updatedAt: row.updated_at,
    };
  }
}
