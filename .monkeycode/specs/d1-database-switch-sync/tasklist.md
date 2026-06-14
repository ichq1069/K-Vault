# 需求实施计划

- [x] 1. 创建 D1 数据库核心模块
  - [x] 1.1 创建 `functions/lib/d1-schema.js` 定义 D1 表结构
    - 包含 files、storage_configs、virtual_folders、sessions、guest_upload_counters、chunk_uploads、app_settings 表
    - 添加必要的索引（folder_path、created_at、storage_type）
    - 参考需求：Requirement 2

  - [x] 1.2 创建 `functions/lib/d1-storage.js` 实现 D1Storage 类
    - 实现 getFileMeta、setFileMeta、deleteFileMeta、listFiles、healthCheck 方法
    - 与现有 KVStorage 接口保持一致
    - 参考需求：Requirement 1

- [x] 2. 实现存储策略路由器
  - [x] 2.1 创建 `functions/lib/storage-router.js`
    - 实现 createStorageRouter 函数，根据环境变量自动选择 D1 或 KV
    - 实现 storageOperation 函数，支持主备切换和双向同步
    - 环境变量：D1_BINDING_NAME、D1_SYNC_MODE（bidirectional/kv-to-d1/d1-to-kv）
    - 参考需求：Requirement 4

  - [ ] 2.2 更新现有 `functions/` 路由文件接入路由器
    - 修改 `functions/api/file/[id].js` 使用 storageOperation 替代直接调用 KV
    - 修改 `functions/api/telegram/webhook.js` 使用 storageOperation
    - 修改 `functions/api/manage/` 相关路由使用 storageOperation
    - 参考需求：Requirement 4

- [x] 3. 实现 KV 到 D1 迁移服务
  - [x] 3.1 创建 `functions/lib/kv-to-d1-migration.js`
    - 实现 KVToD1Migration 类，包含 migrate 和 syncDiff 方法
    - 支持批量处理（batchSize）、断点续传（cursor）
    - 迁移 file: 和 paste: 前缀的 KV 数据
    - 参考需求：Requirement 3

  - [x] 3.2 创建 `functions/api/admin/d1/migrate.js` API 端点
    - POST 接口触发迁移，返回进度信息
    - 支持 resumeCursor 参数实现断点续传
    - 参考需求：Requirement 5

- [x] 4. 实现双向数据同步
  - [x] 4.1 在 storage-router.js 中完善双向同步逻辑
    - 写入 D1 后异步写入 KV（bidirectional 模式）
    - 写入 KV 后异步写入 D1（bidirectional 模式）
    - 错误处理：同步失败仅记录警告，不阻断主流程
    - 参考需求：Requirement 6

  - [x] 4.2 创建 `functions/api/admin/d1/sync.js` API 端点
    - GET 接口比对 KV 和 D1 数据差异
    - 返回 missing（D1 缺失）、outdated（D1 过期）列表
    - POST 接口执行修复操作（direction 参数指定方向）
    - 参考需求：Requirement 6

- [x] 5. 创建 D1 状态查询 API
  - [x] 5.1 创建 `functions/api/admin/d1/status.js`
    - 返回 D1 连接状态、表数量、记录统计
    - 包含 KV 记录数对比
    - 参考需求：Requirement 5

  - [ ] 5.2 更新 `functions/api/status.js` 暴露存储后端信息
    - 在现有状态接口中添加 storageBackend 字段
    - 返回 primary、fallback、syncMode 信息
    - 参考需求：Requirement 4

- [ ] 6. 确保核心功能可用，如有疑问请询问用户

- [x] 7. 创建前端 D1 管理界面
  - [x] 7.1 创建 `frontend/src/views/D1View.vue`
    - D1 状态卡片（连接状态、文件数、存储配置数）
    - 迁移按钮与进度条（显示已迁移/总数、成功率）
    - 同步按钮与差异报告（missing、outdated 数量）
    - 操作日志区域（最近同步记录）
    - 参考需求：Requirement 5

  - [x] 7.2 更新路由和导航
    - 在 `frontend/src/router/index.js` 添加 `/d1` 路由
    - 在 `frontend/src/components/AppShell.vue` 导航栏添加 D1 入口
    - 设置 requiresAdmin 权限保护

  - [ ] 7.3 创建 API 客户端封装
    - 在 `frontend/src/api/client.js` 添加 d1Status、d1Migrate、d1Sync 方法
    - 处理迁移进度轮询（每 2 秒查询一次）

- [x] 8. 编写 wrangler 配置示例
  - [x] 8.1 创建 `wrangler.jsonc.example`
    - 包含 D1 binding 配置示例
    - 包含 KV namespace binding 配置
    - 添加环境变量说明注释

  - [x] 8.2 更新 `README.md` 添加 D1 部署说明
    - D1 数据库创建命令（wrangler d1 create）
    - 环境变量配置说明
    - 迁移操作指南

- [ ] 9. 确保所有测试通过，如有疑问请询问用户
