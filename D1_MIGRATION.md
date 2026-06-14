# K-Vault D1 数据库使用指南

## 概述

K-Vault 现在支持 Cloudflare D1 作为元数据存储后端。默认仍使用 KV Namespace (`img_url`)，同时可选配置 D1。

## D1 优势

- **关系型查询**：支持 SQL 过滤、排序
- **成本优化**：D1 读取/写入费用较 KV 更经济
- **字段管理**：可以直接通过 SQL 管理数据库字段和索引
- **容量扩展**：D1 支持更大的数据集

## 切换步骤

### 1. 创建 D1 数据库

```bash
# 使用 wrangler CLI 创建数据库
wrangler d1 create k-vault-db
```

记下返回的 `database_id`。

### 2. 配置 wrangler.toml

编辑项目根目录的 `wrangler.toml` 文件，将 `database_id` 更新为上一步的值：

```toml
[[d1_databases]]
binding = "db"
database_name = "k-vault-db"
database_id = "替换为真实的数据库 ID"
migrations_dir = "d1"

# (可选) 保留 KV 配置以兼容
[[kv_namespaces]]
binding = "img_url"
id = "YOUR_KV_NAMESPACE_ID"
```

### 3. 执行数据库迁移

```bash
# 应用 D1 schema 迁移
wrangler d1 migrations apply k-vault-db --remote
```

或者使用本地测试：

```bash
# 本地执行迁移（本地开发测试）
wrangler d1 migrations apply k-vault-db
```

### 4. 部署到 Cloudflare

```bash
npm run pages:deploy
```

或在 Cloudflare Dashboard 中重新触发部署。

## 验证 D1 配置

部署后，访问 K-Vault 并上传测试文件，然后查询 D1 数据库验证：

```bash
# 查询已上传的文件
wrangler d1 execute k-vault-db --remote --command "SELECT id, file_name, storage_type, time_stamp FROM files LIMIT 5;"
```

## SQL Schema

数据库结构定义在 `d1/0001_init.sql` 中，包含以下表：

| 表名 | 用途 |
|------|------|
| `files` | 文件元数据存储 |
| `settings` | 应用级别配置 |
| `guest_uploads` | 访客上传计数 |
| `chunk_tasks` | 分片上传任务 |
| `api_tokens` | API Token 管理 |

## 字段管理

使用 D1 后，你可以直接通过 SQL 修改字段：

```sql
-- 添加新字段
ALTER TABLE files ADD COLUMN custom_field TEXT;

-- 更新字段值
UPDATE files SET custom_field = 'value' WHERE id = 'file_id.ext';

-- 查询特定存储类型的文件
SELECT * FROM files WHERE storage_type = 'telegram' AND time_stamp > 1700000000;

-- 统计文件数量
SELECT storage_type, COUNT(*) as count FROM files GROUP BY storage_type;
```

## 兼容性说明

- **自动回退**：如果未配置 D1，系统自动使用 KV (`env.img_url`)
- **双写模式**：目前优先使用 D1，不再写入 KV
- **数据迁移**：如需从 KV 迁移到 D1，可编写迁移脚本将 KV 数据导入 D1

## Cloudflare Pages 配置

部署到 Pages 后，需要在 Pages 项目设置中绑定 D1 数据库：

1. 进入 Cloudflare Dashboard → Pages → 你的项目
2. 设置 → Functions → D1 database bindings
3. 添加绑定：变量名 `db`，选择你的 D1 数据库
4. 重新部署
