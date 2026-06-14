-- K-Vault D1 Database Schema
-- 用于存储文件元数据、用户设置、分享链接等

-- 核心文件元数据表
CREATE TABLE IF NOT EXISTS files (
    -- 主键：对应 KV 中的 key，格式如 fileId.ext 或 r2:key 等
    id TEXT PRIMARY KEY,
    
    -- 创建时间戳
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- 更新时间戳（用于分享次数等更新）
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- ===== 通用元数据字段 =====
    -- 上传时间
    time_stamp INTEGER,
    
    -- 文件管理类型：None, block, white 等
    list_type TEXT DEFAULT 'None',
    
    -- 文件标签
    label TEXT DEFAULT 'None',
    
    -- 是否被收藏/喜欢
    liked INTEGER DEFAULT 0,
    
    -- 原始文件名
    file_name TEXT,
    
    -- 文件大小（字节）
    file_size INTEGER DEFAULT 0,
    
    -- 存储类型：telegram, r2, s3, discord, huggingface, webdav, github
    storage_type TEXT DEFAULT 'telegram',
    
    -- 文件夹路径
    folder_path TEXT,
    
    -- ===== 特定存储后端字段 =====
    -- Telegram Bot API file_id
    telegram_file_id TEXT,
    
    -- Telegram 消息 ID
    telegram_message_id TEXT,
    
    -- 是否使用签名链接
    signed_link INTEGER DEFAULT 0,
    
    -- R2 对象 Key
    r2_key TEXT,
    
    -- S3 对象 Key
    s3_key TEXT,
    
    -- Discord 频道 ID
    discord_channel_id TEXT,
    
    -- Discord 消息 ID
    discord_message_id TEXT,
    
    -- Discord 附件 ID
    discord_attachment_id TEXT,
    
    -- Discord 上传模式
    discord_upload_mode TEXT,
    
    -- Discord 来源 URL
    discord_source_url TEXT,
    
    -- HuggingFace 文件路径
    hf_path TEXT,
    
    -- WebDAV 文件路径
    webdav_path TEXT,
    
    -- WebDAV ETag
    webdav_etag TEXT,
    
    -- GitHub 存储 Key
    github_storage_key TEXT,
    
    -- GitHub 相关动态元数据（JSON 格式）
    github_metadata TEXT,
    
    -- ===== 分享链接相关字段 =====
    -- 分享密码哈希
    share_password_hash TEXT,
    
    -- 分享密码盐
    share_password_salt TEXT,
    
    -- 分享链接过期时间戳
    share_expires_at INTEGER,
    
    -- 最大下载次数
    share_max_downloads INTEGER,
    
    -- 当前下载次数
    share_download_count INTEGER DEFAULT 0
);

-- 设置表：存储应用级别配置
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 访客上传计数表
CREATE TABLE IF NOT EXISTS guest_uploads (
    ip_hash TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    last_upload_at INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 分片上传任务表
CREATE TABLE IF NOT EXISTS chunk_tasks (
    task_id TEXT PRIMARY KEY,
    file_name TEXT,
    total_chunks INTEGER,
    uploaded_chunks INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- API Tokens 表
CREATE TABLE IF NOT EXISTS api_tokens (
    token_hash TEXT PRIMARY KEY,
    name TEXT,
    permissions TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER
);

-- 索引：优化常用查询
CREATE INDEX IF NOT EXISTS idx_files_storage_type ON files(storage_type);
CREATE INDEX IF NOT EXISTS idx_files_folder_path ON files(folder_path);
CREATE INDEX IF NOT EXISTS idx_files_list_type ON files(list_type);
CREATE INDEX IF NOT EXISTS idx_files_time_stamp ON files(time_stamp);
