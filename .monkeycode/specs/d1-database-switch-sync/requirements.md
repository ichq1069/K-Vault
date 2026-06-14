# Requirements Document

## Introduction

为 K-Vault 项目增加 Cloudflare D1 数据库支持，实现在 Cloudflare Pages 模式下从 KV 元数据存储升级到 D1 关系型数据库的平滑切换。同时提供操作方法界面和数据自动同步能力。

## Glossary

- **D1**: Cloudflare 的关系型数据库服务，基于 SQLite，运行在边缘网络
- **KV**: Cloudflare 的键值存储，当前 Cloudflare Pages 模式的元数据存储方案
- **Migration**: 数据迁移过程，将 KV 中的元数据转换并导入 D1
- **Dual Mode**: 项目同时支持 Cloudflare Pages (D1) 和 Docker (SQLite/MySQL) 两种部署模式

## Requirements

### Requirement 1: D1 数据库配置与初始化

**User Story:** AS 开发者，I want 配置 D1 数据库连接，so that Cloudflare Pages 模式可以使用关系型数据库存储元数据。

#### Acceptance Criteria

1. WHEN 项目部署到 Cloudflare Pages，系统 SHALL 读取 `wrangler.jsonc` 中的 D1 binding 配置
2. WHEN D1 binding 可用，系统 SHALL 在首次访问时自动创建所需的数据表结构
3. IF D1 binding 不可用，系统 SHALL 回退到 KV 存储模式并记录警告

### Requirement 2: D1 数据表结构设计

**User Story:** AS 开发者，I want D1 数据表与现有 SQLite schema 保持一致，so that 两种部署模式的数据结构统一。

#### Acceptance Criteria

1. THE 系统 SHALL 在 D1 中创建与 `server/db/schema.sql` 对应的表结构
2. THE 系统 SHALL 包含 `storage_configs`, `files`, `virtual_folders`, `sessions`, `guest_upload_counters`, `chunk_uploads`, `app_settings` 表
3. THE 系统 SHALL 使用 D1 兼容的 SQL 语法（SQLite 子集）

### Requirement 3: KV 到 D1 数据迁移

**User Story:** AS 现有用户，I want 将 KV 中的元数据迁移到 D1，so that 历史数据在切换后仍可访问。

#### Acceptance Criteria

1. WHEN 用户触发迁移操作，系统 SHALL 读取 KV 中所有 `file:` 前缀的元数据记录
2. WHEN 迁移执行，系统 SHALL 将 KV 数据转换为 D1 表结构并批量插入
3. WHILE 迁移进行中，系统 SHALL 显示迁移进度（已处理/总数）
4. IF 迁移中断，系统 SHALL 支持断点续传，从上次成功的位置继续
5. IF 迁移完成，系统 SHALL 输出迁移统计（成功数、失败数、跳过数）

### Requirement 4: 运行时自动切换

**User Story:** AS 用户，I want 系统在 D1 可用时自动使用 D1，so that 无需手动配置即可享受关系型数据库优势。

#### Acceptance Criteria

1. WHEN D1 binding 存在且健康，系统 SHALL 自动使用 D1 作为元数据存储
2. WHILE D1 不可用，系统 SHALL 回退到 KV 模式并继续服务
3. THE 系统 SHALL 在 `/api/status` 接口中暴露当前存储后端信息

### Requirement 5: D1 管理操作界面

**User Story:** AS 管理员，I want 在后台管理 D1 数据库，so that 可以执行迁移、查看状态、手动同步等操作。

#### Acceptance Criteria

1. WHEN 管理员访问 `/admin` 后台，系统 SHALL 显示 D1 状态卡片（连接状态、表数量、记录数）
2. WHEN 管理员点击"迁移"按钮，系统 SHALL 启动 KV 到 D1 的迁移流程
3. WHILE 迁移进行中，系统 SHALL 实时显示进度条和统计信息
4. IF 管理员点击"同步"按钮，系统 SHALL 比对 KV 和 D1 数据并修复不一致

### Requirement 6: 双向数据同步

**User Story:** AS 用户，I want KV 和 D1 之间的数据保持一致，so that 切换过程不会丢失任何元数据。

#### Acceptance Criteria

1. WHEN 在 D1 模式下创建文件，系统 SHALL 同时写入 KV 作为备份（可选）
2. WHEN 在 D1 模式下删除文件，系统 SHALL 同时删除 KV 中的对应记录
3. WHEN 管理员执行同步操作，系统 SHALL 比对 KV 和 D1 并输出差异报告
4. IF 发现不一致，系统 SHALL 提供修复选项以 D1 为准或以 KV 为准

## Dependencies

- Cloudflare Pages 部署环境
- D1 数据库 binding 配置
- 现有 KV namespace 中已有元数据

## Out of Scope

- D1 数据库的备份与恢复（由 Cloudflare 平台提供）
- 跨账户 D1 数据迁移
- D1 性能调优与索引优化
