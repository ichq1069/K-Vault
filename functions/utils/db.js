// K-Vault D1/KV Dual-Compatible Database Access Layer
// 统一的元数据存储访问层，优先使用 D1，自动回退到 KV

const STORAGE_PREFIXES = ['img:', 'vid:', 'aud:', 'doc:', 'r2:', 's3:', 'discord:', 'hf:', 'webdav:', 'github:', ''];

/**
 * 判断使用哪种存储后端
 * D1 优先（如果 env.db 存在），否则使用 KV (env.img_url)
 */
function getMetaStore(env) {
  if (env.db?.prepare) {
    return { type: 'd1', db: env.db };
  }
  if (env.img_url?.getWithMetadata) {
    return { type: 'kv', kv: env.img_url };
  }
  return { type: 'none' };
}

/**
 * Metadata 字段名映射（DB 表字段名 <-> KV metadata 字段名）
 */
const FIELD_MAP = {
  'time_stamp': 'TimeStamp',
  'list_type': 'ListType',
  'label': 'Label',
  'liked': 'liked',
  'file_name': 'fileName',
  'file_size': 'fileSize',
  'storage_type': 'storageType',
  'folder_path': 'folderPath',
  'telegram_file_id': 'telegramFileId',
  'telegram_message_id': 'telegramMessageId',
  'signed_link': 'signedLink',
  'r2_key': 'r2Key',
  's3_key': 's3Key',
  'discord_channel_id': 'discordChannelId',
  'discord_message_id': 'discordMessageId',
  'discord_attachment_id': 'discordAttachmentId',
  'discord_upload_mode': 'discordUploadMode',
  'discord_source_url': 'discordSourceUrl',
  'hf_path': 'hfPath',
  'webdav_path': 'webdavPath',
  'webdav_etag': 'webdavEtag',
  'github_storage_key': 'githubStorageKey',
  'github_metadata': 'githubMetadata',
  'share_password_hash': 'sharePasswordHash',
  'share_password_salt': 'sharePasswordSalt',
  'share_expires_at': 'shareExpiresAt',
  'share_max_downloads': 'shareMaxDownloads',
  'share_download_count': 'shareDownloadCount',
};

/**
 * 将 D1 行记录转换为 KV metadata 格式
 * 保持与原有 KV 结构的兼容性
 */
function dbToKVMetadata(row) {
  if (!row) return null;
  
  const metadata = {};
  for (const [dbField, kvField] of Object.entries(FIELD_MAP)) {
    const value = row[dbField];
    if (value !== null && value !== undefined) {
      // 处理布尔值/整数转换
      if (dbField === 'liked' || dbField === 'signed_link') {
        metadata[kvField] = Boolean(value);
      } else {
        metadata[kvField] = value;
      }
    }
  }
  return metadata;
}

/**
 * 将 KV metadata 对象转换为 D1 字段
 */
function kvToDBFields(id, metadata) {
  const fields = {
    id,
    time_stamp: metadata.TimeStamp,
    list_type: metadata.ListType || 'None',
    label: metadata.Label || 'None',
    liked: metadata.liked ? 1 : 0,
    file_name: metadata.fileName,
    file_size: metadata.fileSize || 0,
    storage_type: metadata.storageType || 'telegram',
    folder_path: metadata.folderPath || null,
    telegram_file_id: metadata.telegramFileId || null,
    telegram_message_id: metadata.telegramMessageId || null,
    signed_link: metadata.signedLink ? 1 : 0,
    r2_key: metadata.r2Key || null,
    s3_key: metadata.s3Key || null,
    discord_channel_id: metadata.discordChannelId || null,
    discord_message_id: metadata.discordMessageId || null,
    discord_attachment_id: metadata.discordAttachmentId || null,
    discord_upload_mode: metadata.discordUploadMode || null,
    discord_source_url: metadata.discordSourceUrl || null,
    hf_path: metadata.hfPath || null,
    webdav_path: metadata.webdavPath || null,
    webdav_etag: metadata.webdavEtag || null,
    github_storage_key: metadata.githubStorageKey || null,
    github_metadata: metadata.githubMetadata || null,
    share_password_hash: metadata.sharePasswordHash || null,
    share_password_salt: metadata.sharePasswordSalt || null,
    share_expires_at: metadata.shareExpiresAt || null,
    share_max_downloads: metadata.shareMaxDownloads || null,
    share_download_count: metadata.shareDownloadCount || 0,
    updated_at: Math.floor(Date.now() / 1000),
  };
  return fields;
}

/**
 * 获取文件元数据记录
 * @param {Object} env - Cloudflare env
 * @param {string} id - 记录的 ID（对应 KV key）
 * @returns {{ record: { metadata: Object } | null, kvKey: string }}
 */
export async function getRecordWithKey(env, id) {
  const store = getMetaStore(env);
  
  if (store.type === 'd1') {
    const { db } = store;
    // 尝试直接使用 ID 查询
    let row = await db.prepare('SELECT * FROM files WHERE id = ?')
      .bind(id)
      .first();
    
    // 如果没用记录，尝试带前缀查询（兼容 R2、S3 等格式）
    if (!row) {
      for (const prefix of STORAGE_PREFIXES) {
        if (!prefix) continue;
        const prefixedId = `${prefix}${id}`;
        row = await db.prepare('SELECT * FROM files WHERE id = ?')
          .bind(prefixedId)
          .first();
        if (row) {
          return { record: { metadata: dbToKVMetadata(row) }, kvKey: prefixedId };
        }
      }
      return { record: null, kvKey: id };
    }
    
    return { record: { metadata: dbToKVMetadata(row) }, kvKey: row.id };
  }
  
  // KV 回退逻辑
  if (store.type === 'kv') {
    const { kv } = store;
    const hasKnownPrefix = STORAGE_PREFIXES.some((prefix) => prefix && id.startsWith(prefix));
    const candidateKeys = hasKnownPrefix ? [id] : STORAGE_PREFIXES.map((prefix) => `${prefix}${id}`);
    
    for (const key of candidateKeys) {
      const record = await kv.getWithMetadata(key);
      if (record?.metadata) {
        return { record, kvKey: key };
      }
    }
  }
  
  return { record: null, kvKey: id };
}

/**
 * 保存文件元数据记录
 * @param {Object} env - Cloudflare env
 * @param {string} id - 记录的 ID
 * @param {string} value - KV 的值（通常为空字符串，D1 时忽略）
 * @param {Object} options - { metadata: Object }
 */
export async function putRecord(env, id, value, options = {}) {
  const metadata = options.metadata || {};
  const store = getMetaStore(env);
  
  if (store.type === 'd1') {
    const { db } = store;
    const fields = kvToDBFields(id, metadata);
    const columns = Object.keys(fields).join(', ');
    const placeholders = Object.keys(fields).map(() => '?').join(', ');
    const updates = Object.keys(fields)
      .map((col) => `${col} = excluded.${col}`)
      .join(', ');
    
    // 使用 INSERT OR REPLACE，如果记录存在则更新
    const sql = `INSERT INTO files (${columns}) VALUES (${placeholders})
                 ON CONFLICT(id) DO UPDATE SET ${updates}`;
    
    await db.prepare(sql)
      .bind(...Object.values(fields))
      .run();
    return;
  }
  
  // KV 回退逻辑
  if (store.type === 'kv') {
    const { kv } = store;
    await kv.put(id, value, { metadata });
  }
}

/**
 * 删除文件元数据记录
 * @param {Object} env - Cloudflare env
 * @param {string} id - 记录的 ID
 */
export async function deleteRecord(env, id) {
  const store = getMetaStore(env);
  
  if (store.type === 'd1') {
    const { db } = store;
    await db.prepare('DELETE FROM files WHERE id = ?')
      .bind(id)
      .run();
    return;
  }
  
  // KV 回退逻辑
  if (store.type === 'kv') {
    const { kv } = store;
    await kv.delete(id);
  }
}

/**
 * 列出文件记录（支持前缀过滤和分页）
 * @param {Object} env - Cloudflare env
 * @param {Object} options - { limit?: number, cursor?: string, prefix?: string }
 * @returns {{ records: Array, cursor?: string }}
 */
export async function listRecords(env, options = {}) {
  const { limit = 100, cursor = null, prefix = '' } = options;
  const store = getMetaStore(env);
  
  if (store.type === 'd1') {
    const { db } = store;
    let sql = 'SELECT * FROM files';
    const params = [];
    
    if (prefix) {
      // D1 中实现类似 KV 的 prefix 匹配
      sql += ' WHERE id LIKE ?';
      params.push(`${prefix}%`);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (cursor) {
      // 基于时间戳分页
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, parseInt(cursor, 10));
    } else {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    
    const result = await db.prepare(sql)
      .bind(...params)
      .all();
    
    const records = (result.results || []).map((row) => ({
      name: row.id,
      metadata: dbToKVMetadata(row),
    }));
    
    const nextCursor = records.length >= limit
      ? String((parseInt(cursor, 10) || 0) + limit)
      : undefined;
    
    return { records, cursor: nextCursor };
  }
  
  // KV 回退逻辑
  if (store.type === 'kv') {
    const { kv } = store;
    const listOptions = { limit };
    if (prefix) listOptions.prefix = prefix;
    if (cursor) listOptions.cursor = cursor;
    
    const page = await kv.list(listOptions);
    
    return {
      records: page.keys || [],
      cursor: page.cursor,
    };
  }
  
  return { records: [] };
}

/**
 * 获取设置值
 * @param {Object} env - Cloudflare env
 * @param {string} key - 设置键名
 * @returns {string|null} 设置值
 */
export async function getSetting(env, key) {
  const store = getMetaStore(env);
  
  if (store.type === 'd1') {
    const { db } = store;
    const row = await db.prepare('SELECT value FROM settings WHERE id = ?')
      .bind(key)
      .first();
    return row?.value || null;
  }
  
  if (store.type === 'kv') {
    const { kv } = store;
    return await kv.get(`setting:${key}`);
  }
  
  return null;
}

/**
 * 保存设置值
 * @param {Object} env - Cloudflare env
 * @param {string} key - 设置键名
 * @param {string} value - 设置值
 */
export async function putSetting(env, key, value) {
  const store = getMetaStore(env);
  
  if (store.type === 'd1') {
    const { db } = store;
    await db.prepare(
      'INSERT INTO settings (id, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    )
      .bind(key, value, Math.floor(Date.now() / 1000))
      .run();
    return;
  }
  
  if (store.type === 'kv') {
    const { kv } = store;
    await kv.put(`setting:${key}`, value);
  }
}

/**
 * 删除设置值
 * @param {Object} env - Cloudflare env
 * @param {string} key - 设置键名
 */
export async function deleteSetting(env, key) {
  const store = getMetaStore(env);
  
  if (store.type === 'd1') {
    const { db } = store;
    await db.prepare('DELETE FROM settings WHERE id = ?')
      .bind(key)
      .run();
    return;
  }
  
  if (store.type === 'kv') {
    const { kv } = store;
    await kv.delete(`setting:${key}`);
  }
}

/**
 * 初始化 D1 数据库（如果尚未初始化）
 * 可以在 Worker 启动时调用
 * @param {Object} env - Cloudflare env
 */
export async function initDatabase(env) {
  const store = getMetaStore(env);
  if (store.type !== 'd1') return;
  
  const { db } = store;
  
  // 检查主表是否存在
  try {
    await db.prepare('SELECT COUNT(*) FROM files').run();
  } catch {
    // 表不存在，执行初始化
    const migrations = [
      `CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        time_stamp INTEGER,
        list_type TEXT DEFAULT 'None',
        label TEXT DEFAULT 'None',
        liked INTEGER DEFAULT 0,
        file_name TEXT,
        file_size INTEGER DEFAULT 0,
        storage_type TEXT DEFAULT 'telegram',
        folder_path TEXT,
        telegram_file_id TEXT,
        telegram_message_id TEXT,
        signed_link INTEGER DEFAULT 0,
        r2_key TEXT,
        s3_key TEXT,
        discord_channel_id TEXT,
        discord_message_id TEXT,
        discord_attachment_id TEXT,
        discord_upload_mode TEXT,
        discord_source_url TEXT,
        hf_path TEXT,
        webdav_path TEXT,
        webdav_etag TEXT,
        github_storage_key TEXT,
        github_metadata TEXT,
        share_password_hash TEXT,
        share_password_salt TEXT,
        share_expires_at INTEGER,
        share_max_downloads INTEGER,
        share_download_count INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_files_storage_type ON files(storage_type)`,
      `CREATE INDEX IF NOT EXISTS idx_files_folder_path ON files(folder_path)`,
      `CREATE INDEX IF NOT EXISTS idx_files_list_type ON files(list_type)`,
      `CREATE INDEX IF NOT EXISTS idx_files_time_stamp ON files(time_stamp)`,
    ];
    
    for (const sql of migrations) {
      await db.prepare(sql).run();
    }
  }
}
