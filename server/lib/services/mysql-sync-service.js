const mysqlDb = require('../../db/mysql');

class MySQLSyncService {
  constructor() {
    this.enabled = false;
  }

  async init(config) {
    if (!config?.host || !config?.database) {
      this.enabled = false;
      return false;
    }

    this.enabled = await mysqlDb.initMySQL(config);
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  async syncFileWrite(fileData, source = 'api') {
    if (!this.enabled) return { synced: false, reason: 'disabled' };

    try {
      await mysqlDb.execute(
        `INSERT INTO kvault_files (
          id, storage_type, storage_key, file_name, file_size, mime_type,
          folder_path, list_type, label, liked, telegram_file_id,
          telegram_message_id, r2_key, s3_key, extra_json, source,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          storage_type = VALUES(storage_type),
          storage_key = VALUES(storage_key),
          file_name = VALUES(file_name),
          file_size = VALUES(file_size),
          mime_type = VALUES(mime_type),
          folder_path = VALUES(folder_path),
          list_type = VALUES(list_type),
          label = VALUES(label),
          liked = VALUES(liked),
          telegram_file_id = VALUES(telegram_file_id),
          telegram_message_id = VALUES(telegram_message_id),
          r2_key = VALUES(r2_key),
          s3_key = VALUES(s3_key),
          extra_json = VALUES(extra_json),
          updated_at = VALUES(updated_at)`,
        [
          fileData.id,
          fileData.storageType || 'telegram',
          fileData.storageKey || fileData.id,
          fileData.fileName || 'unknown',
          fileData.fileSize || 0,
          fileData.mimeType || null,
          fileData.folderPath || '',
          fileData.listType || 'None',
          fileData.label || 'None',
          fileData.liked ? 1 : 0,
          fileData.telegramFileId || null,
          fileData.telegramMessageId || null,
          fileData.r2Key || null,
          fileData.s3Key || null,
          fileData.extra ? JSON.stringify(fileData.extra) : '{}',
          source,
          fileData.createdAt || Date.now(),
          fileData.updatedAt || Date.now(),
        ]
      );

      await this.logSync(fileData.id, 'write', source, 'success');
      return { synced: true };
    } catch (error) {
      await this.logSync(fileData.id, 'write', source, 'error', error.message);
      console.error('MySQL sync write failed:', error.message);
      return { synced: false, error: error.message };
    }
  }

  async syncFileUpdate(fileId, patch, source = 'api') {
    if (!this.enabled) return { synced: false, reason: 'disabled' };

    const updates = [];
    const values = [];

    const fieldMap = {
      fileName: 'file_name',
      file_size: 'fileSize',
      mimeType: 'mime_type',
      folderPath: 'folder_path',
      listType: 'list_type',
      label: 'label',
      liked: 'liked',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (patch[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(key === 'liked' ? (patch[key] ? 1 : 0) : patch[key]);
      }
    }

    if (updates.length === 0) return { synced: false, reason: 'no-updates' };

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(fileId);

    try {
      await mysqlDb.execute(
        `UPDATE kvault_files SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      await this.logSync(fileId, 'update', source, 'success');
      return { synced: true };
    } catch (error) {
      await this.logSync(fileId, 'update', source, 'error', error.message);
      console.error('MySQL sync update failed:', error.message);
      return { synced: false, error: error.message };
    }
  }

  async syncFileDelete(fileId, source = 'api') {
    if (!this.enabled) return { synced: false, reason: 'disabled' };

    try {
      await mysqlDb.execute('DELETE FROM kvault_files WHERE id = ?', [fileId]);
      await this.logSync(fileId, 'delete', source, 'success');
      return { synced: true };
    } catch (error) {
      await this.logSync(fileId, 'delete', source, 'error', error.message);
      console.error('MySQL sync delete failed:', error.message);
      return { synced: false, error: error.message };
    }
  }

  async listFiles({ page = 1, limit = 50, storageType, folderPath, search } = {}) {
    if (!this.enabled) return { files: [], total: 0 };

    const conditions = [];
    const params = [];

    if (storageType && storageType !== 'all') {
      conditions.push('storage_type = ?');
      params.push(storageType);
    }

    if (folderPath !== undefined) {
      conditions.push('folder_path = ?');
      params.push(folderPath || '');
    }

    if (search) {
      conditions.push('file_name LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult] = await mysqlDb.query(
      `SELECT COUNT(*) as total FROM kvault_files ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    const offset = (page - 1) * limit;
    const files = await mysqlDb.query(
      `SELECT * FROM kvault_files ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { files, total, page, limit };
  }

  async getFileById(fileId) {
    if (!this.enabled) return null;

    const rows = await mysqlDb.query('SELECT * FROM kvault_files WHERE id = ?', [fileId]);
    return rows[0] || null;
  }

  async getStats() {
    if (!this.enabled) return null;

    const [totalResult] = await mysqlDb.query('SELECT COUNT(*) as total FROM kvault_files');
    const total = totalResult[0]?.total || 0;

    const storageResult = await mysqlDb.query(
      'SELECT storage_type, COUNT(*) as count FROM kvault_files GROUP BY storage_type'
    );

    const sizeResult = await mysqlDb.query('SELECT SUM(file_size) as total_size FROM kvault_files');
    const totalSize = sizeResult[0]?.total_size || 0;

    return {
      total,
      byStorage: storageResult.reduce((acc, row) => {
        acc[row.storage_type] = row.count;
        return acc;
      }, {}),
      totalSize,
    };
  }

  async logSync(fileId, action, source, status, errorMessage = null) {
    try {
      await mysqlDb.execute(
        'INSERT INTO kvault_sync_log (file_id, action, source, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [fileId, action, source, status, errorMessage, Date.now()]
      );
    } catch (error) {
      // best-effort logging
    }
  }

  async getSyncLogs({ page = 1, limit = 50 } = {}) {
    if (!this.enabled) return { logs: [], total: 0 };

    const [countResult] = await mysqlDb.query('SELECT COUNT(*) as total FROM kvault_sync_log');
    const total = countResult[0]?.total || 0;

    const offset = (page - 1) * limit;
    const logs = await mysqlDb.query(
      'SELECT * FROM kvault_sync_log ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    return { logs, total, page, limit };
  }
}

module.exports = { MySQLSyncService };
