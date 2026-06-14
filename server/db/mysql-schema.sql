-- MySQL schema for K-Vault file sync
CREATE TABLE IF NOT EXISTS kvault_files (
  id VARCHAR(255) PRIMARY KEY,
  storage_type VARCHAR(50) NOT NULL,
  storage_key TEXT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(255),
  folder_path VARCHAR(1000) NOT NULL DEFAULT '',
  list_type VARCHAR(20) NOT NULL DEFAULT 'None',
  label VARCHAR(20) NOT NULL DEFAULT 'None',
  liked TINYINT(1) NOT NULL DEFAULT 0,
  telegram_file_id VARCHAR(500),
  telegram_message_id BIGINT,
  r2_key VARCHAR(500),
  s3_key VARCHAR(500),
  extra_json JSON,
  source VARCHAR(50) DEFAULT 'api',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_created_at (created_at DESC),
  INDEX idx_storage_type (storage_type),
  INDEX idx_list_type (list_type),
  INDEX idx_folder_path (folder_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kvault_sync_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  file_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at BIGINT NOT NULL,
  INDEX idx_file_id (file_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
