<template>
  <div class="page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1>☁️ D1 Database</h1>
          <p>Manage Cloudflare D1 database migration and synchronization</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="refreshStatus">
            <span class="btn-icon">🔄</span>
            Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading D1 status...</p>
    </div>

    <!-- D1 未配置状态 -->
    <div v-else-if="!status.available" class="empty-state">
      <div class="empty-icon">⚠️</div>
      <h3>D1 Not Configured</h3>
      <p>{{ status.reason || 'D1 binding is missing in your Cloudflare Pages configuration.' }}</p>
      <div class="setup-steps">
        <h4>Setup Guide:</h4>
        <ol>
          <li>Create D1 database: <code>npx wrangler d1 create 特控tele-d1</code></li>
          <li>Add binding to <code>wrangler.jsonc</code></li>
          <li>Redeploy your Cloudflare Pages project</li>
        </ol>
      </div>
    </div>

    <!-- D1 已配置状态 -->
    <template v-else>
      <!-- 状态卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-value">{{ status.stats?.fileCount || 0 }}</div>
          <div class="stat-label">Files in D1</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💾</div>
          <div class="stat-value">{{ status.stats?.storageCount || 0 }}</div>
          <div class="stat-label">Storage Configs</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-value">{{ status.health?.type?.toUpperCase() || 'D1' }}</div>
          <div class="stat-label">Primary Backend</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔗</div>
          <div class="stat-value">{{ status.stats?.kvFileCount || 'N/A' }}</div>
          <div class="stat-label">KV Status</div>
        </div>
      </div>

      <!-- 迁移区域 -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <h2>📥 Migration (KV → D1)</h2>
            <p>Migrate existing metadata from KV namespace to D1 database</p>
          </div>
        </div>

        <div class="section-content">
          <div class="action-bar">
            <button 
              class="btn btn-primary btn-large" 
              :disabled="migrating"
              @click="startMigration"
            >
              <span class="btn-icon">{{ migrating ? '⏳' : '🚀' }}</span>
              {{ migrating ? 'Migrating...' : 'Start Migration' }}
            </button>
            
            <div v-if="migrationResult" class="result-badge" :class="{ success: !migrationResult.error, error: migrationResult.error }">
              <span v-if="migrationResult.error">❌ {{ migrationResult.error }}</span>
              <template v-else>
                ✅ Migrated: {{ migrationResult.totalMigrated }}
                <span v-if="migrationResult.totalSkipped" class="text-muted">Skipped: {{ migrationResult.totalSkipped }}</span>
                <span v-if="migrationResult.totalFailed" class="text-danger">Failed: {{ migrationResult.totalFailed }}</span>
              </template>
            </div>
          </div>

          <div v-if="migrating" class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${migrationProgress}%` }"></div>
            </div>
            <span class="progress-text">{{ migrationProgress }}%</span>
          </div>
        </div>
      </div>

      <!-- 同步区域 -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <h2>🔄 Sync & Repair</h2>
            <p>Compare KV and D1 data, fix inconsistencies</p>
          </div>
        </div>

        <div class="section-content">
          <div class="action-bar">
            <button class="btn btn-secondary" @click="checkDiff">
              <span class="btn-icon">🔍</span>
              Check Differences
            </button>
            <button 
              class="btn btn-primary" 
              :disabled="syncing || !diffResult"
              @click="startSync"
            >
              <span class="btn-icon">{{ syncing ? '⏳' : '🔧' }}</span>
              {{ syncing ? 'Syncing...' : 'Sync KV → D1' }}
            </button>
          </div>

          <div v-if="diffResult" class="diff-report">
            <div class="report-grid">
              <div class="report-item warning">
                <div class="report-value">{{ diffResult.missing.length }}</div>
                <div class="report-label">Missing in D1</div>
              </div>
              <div class="report-item info">
                <div class="report-value">{{ diffResult.outdated.length }}</div>
                <div class="report-label">Outdated in D1</div>
              </div>
              <div class="report-item neutral">
                <div class="report-value">{{ diffResult.kvCount }}</div>
                <div class="report-label">KV Total</div>
              </div>
              <div class="report-item neutral">
                <div class="report-value">{{ diffResult.d1Count }}</div>
                <div class="report-label">D1 Total</div>
              </div>
            </div>
          </div>

          <div v-if="syncResult" class="sync-result" :class="{ success: !syncResult.error, error: syncResult.error }">
            <span v-if="syncResult.error">❌ {{ syncResult.error }}</span>
            <template v-else>
              ✅ Synced: {{ syncResult.synced }}
              <span v-if="syncResult.failed" class="text-danger">Failed: {{ syncResult.failed }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 数据表信息 -->
      <div class="section-card">
        <div class="section-header">
          <h2>📋 Database Tables</h2>
        </div>
        <div class="section-content">
          <div class="table-grid">
            <div v-for="table in status.tables" :key="table" class="table-item">
              <span class="table-icon">📊</span>
              <span class="table-name">{{ table }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const status = ref({ available: false, stats: {}, health: {}, tables: [] });
const loading = ref(true);
const migrating = ref(false);
const migrationResult = ref(null);
const migrationProgress = ref(0);
const diffResult = ref(null);
const syncing = ref(false);
const syncResult = ref(null);

onMounted(async () => {
  await refreshStatus();
});

async function refreshStatus() {
  loading.value = true;
  try {
    const res = await fetch('/api/admin/d1/status');
    status.value = await res.json();
  } catch (err) {
    status.value = { available: false, error: err.message };
  } finally {
    loading.value = false;
  }
}

async function startMigration() {
  migrating.value = true;
  migrationResult.value = null;
  migrationProgress.value = 0;

  try {
    // 模拟进度
    const progressInterval = setInterval(() => {
      if (migrationProgress.value < 90) {
        migrationProgress.value += 10;
      }
    }, 500);

    const res = await fetch('/api/admin/d1/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize: 50 }),
    });

    clearInterval(progressInterval);
    migrationProgress.value = 100;
    migrationResult.value = await res.json();
  } catch (err) {
    console.error('Migration failed:', err);
    migrationResult.value = { error: err.message };
  } finally {
    migrating.value = false;
  }
}

async function checkDiff() {
  try {
    const res = await fetch('/api/admin/d1/sync');
    diffResult.value = await res.json();
  } catch (err) {
    console.error('Diff check failed:', err);
  }
}

async function startSync() {
  syncing.value = true;
  syncResult.value = null;

  try {
    const res = await fetch('/api/admin/d1/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: 'kv-to-d1' }),
    });

    syncResult.value = await res.json();
    
    // 同步后刷新状态和差异
    await Promise.all([refreshStatus(), checkDiff()]);
  } catch (err) {
    console.error('Sync failed:', err);
    syncResult.value = { error: err.message };
  } finally {
    syncing.value = false;
  }
}
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* 页面头部 */
.page-header {
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.header-left h1 {
  font-size: 28px;
  margin: 0 0 8px;
  color: var(--text-color, #1f2937);
}

.header-left p {
  margin: 0;
  color: var(--muted-color, #6b7280);
  font-size: 14px;
}

/* 加载和空状态 */
.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--card-bg, rgba(255, 255, 255, 0.9));
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color, rgba(0, 0, 0, 0.1));
  border-top-color: var(--primary-color, #8a4bff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 12px;
  color: var(--text-color, #1f2937);
}

.setup-steps {
  margin-top: 24px;
  text-align: left;
  background: var(--code-bg, #f5f7fa);
  padding: 20px;
  border-radius: 12px;
}

.setup-steps code {
  background: var(--code-bg, #e5e7eb);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--card-bg, rgba(255, 255, 255, 0.9));
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary-color, #8a4bff);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--muted-color, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 区块卡片 */
.section-card {
  background: var(--card-bg, rgba(255, 255, 255, 0.9));
  border-radius: 16px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  overflow: hidden;
}

.section-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
}

.section-header h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--text-color, #1f2937);
}

.section-header p {
  margin: 0;
  color: var(--muted-color, #6b7280);
  font-size: 14px;
}

.section-content {
  padding: 24px;
}

/* 操作栏 */
.action-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

/* 按钮样式 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color, #8a4bff);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark, #6c3ce0);
}

.btn-secondary {
  background: var(--secondary-bg, #f5f7fa);
  color: var(--text-color, #1f2937);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.2));
}

.btn-secondary:hover:not(:disabled) {
  background: var(--hover-bg, #e5e7eb);
}

.btn-large {
  padding: 12px 28px;
  font-size: 16px;
}

.btn-icon {
  font-size: 16px;
}

/* 进度条 */
.progress-container {
  display: flex;
  align-items: center;
  gap: 16px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--progress-bg, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color, #8a4bff), var(--primary-light, #b39ddb));
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color, #8a4bff);
  min-width: 40px;
  text-align: right;
}

/* 结果标签 */
.result-badge {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.result-badge.success {
  background: var(--success-bg, #d1fae5);
  color: var(--success-color, #059669);
}

.result-badge.error {
  background: var(--error-bg, #fee2e2);
  color: var(--error-color, #dc2626);
}

/* 差异报告 */
.diff-report {
  background: var(--warning-bg, #fffbeb);
  border-radius: 12px;
  padding: 20px;
  margin-top: 16px;
  border-left: 4px solid var(--warning-color, #f59e0b);
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.report-item {
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
}

.report-item.warning { border-top: 3px solid #f59e0b; }
.report-item.info { border-top: 3px solid #3b82f6; }
.report-item.neutral { border-top: 3px solid #6b7280; }

.report-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.report-label {
  font-size: 12px;
  color: var(--muted-color, #6b7280);
  text-transform: uppercase;
}

/* 同步结果 */
.sync-result {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.sync-result.success {
  background: var(--success-bg, #d1fae5);
  color: var(--success-color, #059669);
}

.sync-result.error {
  background: var(--error-bg, #fee2e2);
  color: var(--error-color, #dc2626);
}

/* 表格网格 */
.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.table-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--code-bg, #f5f7fa);
  border-radius: 8px;
  font-size: 14px;
}

.table-icon {
  font-size: 16px;
}

.table-name {
  font-family: monospace;
  font-weight: 500;
}

/* 文本颜色 */
.text-muted { color: var(--muted-color, #6b7280); }
.text-danger { color: var(--error-color, #dc2626); }

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
  .stat-card,
  .section-card {
    background: rgba(15, 23, 39, 0.9);
    border-color: rgba(130, 152, 196, 0.35);
  }
  
  .header-left h1,
  .section-header h2 {
    color: #e8eeff;
  }
  
  .stat-value,
  .progress-text,
  .report-value {
    color: #9aa9ff;
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .report-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
