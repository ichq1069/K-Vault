<template>
  <div class="page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1>🗄️ MySQL Database</h1>
          <p>View synchronized file records from MySQL database</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="refreshAll">
            <span class="btn-icon">🔄</span>
            Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- MySQL 未配置状态 -->
    <div v-if="!mysqlEnabled" class="empty-state">
      <div class="empty-icon">⚠️</div>
      <h3>MySQL Not Configured</h3>
      <p>Set MYSQL_HOST and MYSQL_DATABASE environment variables to enable MySQL synchronization.</p>
    </div>

    <!-- MySQL 已配置状态 -->
    <template v-else>
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-value">{{ stats.total || 0 }}</div>
          <div class="stat-label">Total Files</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💾</div>
          <div class="stat-value">{{ formatSize(stats.totalSize || 0) }}</div>
          <div class="stat-label">Total Size</div>
        </div>
        <div v-for="(count, type) in stats.byStorage" :key="type" class="stat-card">
          <div class="stat-icon">☁️</div>
          <div class="stat-value">{{ count }}</div>
          <div class="stat-label">{{ type.toUpperCase() }}</div>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="toolbar-card">
        <div class="toolbar-content">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input 
              v-model.trim="search" 
              placeholder="Search files by name..." 
              @keyup.enter="loadFiles"
              class="search-input"
            />
          </div>
          <select v-model="storageFilter" @change="loadFiles" class="filter-select">
            <option value="all">All Storage</option>
            <option value="telegram">Telegram</option>
            <option value="r2">R2</option>
            <option value="s3">S3</option>
            <option value="discord">Discord</option>
            <option value="webdav">WebDAV</option>
            <option value="github">GitHub</option>
          </select>
        </div>
      </div>

      <!-- 文件表格 -->
      <div class="table-card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>File Name</th>
                <th>Storage</th>
                <th>Size</th>
                <th>Folder</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in files" :key="file.id" class="table-row">
                <td><code class="id-code">{{ truncateId(file.id) }}</code></td>
                <td><strong class="file-name">{{ file.file_name }}</strong></td>
                <td>
                  <span class="storage-badge" :class="file.storage_type">
                    {{ file.storage_type }}
                  </span>
                </td>
                <td>{{ formatSize(file.file_size) }}</td>
                <td><span class="folder-path">{{ file.folder_path || '/' }}</span></td>
                <td>{{ formatTime(file.created_at) }}</td>
                <td>
                  <div class="table-actions">
                    <a class="btn btn-sm" :href="`/file/${encodeURIComponent(file.id)}`" target="_blank">
                      Open
                    </a>
                    <button class="btn btn-sm btn-secondary" @click="viewDetails(file)">
                      Details
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && files.length === 0">
                <td colspan="7" class="empty-row">
                  <div class="empty-cell">
                    <span class="empty-icon">📭</span>
                    <p>No files in MySQL database.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination-bar">
        <button class="btn btn-secondary" :disabled="loading || !hasMore" @click="loadMore">
          <span class="btn-icon">{{ loading ? '⏳' : '📄' }}</span>
          {{ loading ? 'Loading...' : 'Load More' }}
        </button>
        <span class="pagination-info">
          {{ files.length }} / {{ total }} files
        </span>
      </div>
    </template>

    <!-- 详情弹窗 -->
    <div v-if="selectedFile" class="modal-overlay" @click.self="selectedFile = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3>📋 File Details</h3>
          <button class="close-btn" @click="selectedFile = null">✕</button>
        </div>
        <pre class="json-view">{{ JSON.stringify(selectedFile, null, 2) }}</pre>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="selectedFile = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiFetch } from '../api/client';

const files = ref([]);
const stats = ref({});
const loading = ref(false);
const search = ref('');
const storageFilter = ref('all');
const page = ref(1);
const total = ref(0);
const mysqlEnabled = ref(false);
const selectedFile = ref(null);
const hasMore = ref(true);

onMounted(async () => {
  await checkStatus();
  if (mysqlEnabled.value) {
    await refreshAll();
  }
});

async function checkStatus() {
  try {
    const status = await apiFetch('/api/mysql/status');
    mysqlEnabled.value = status.enabled;
  } catch {
    mysqlEnabled.value = false;
  }
}

async function refreshAll() {
  page.value = 1;
  files.value = [];
  await Promise.all([loadFiles(true), loadStats()]);
}

async function loadFiles(reset) {
  if (loading.value) return;
  loading.value = true;

  try {
    if (reset) page.value = 1;

    const query = new URLSearchParams({
      page: page.value,
      limit: 50,
      storageType: storageFilter.value,
      search: search.value,
    });

    const result = await apiFetch(`/api/mysql/files?${query.toString()}`);
    const newFiles = result.files || [];

    if (reset) {
      files.value = newFiles;
    } else {
      files.value.push(...newFiles);
    }

    total.value = result.total || 0;
    hasMore.value = files.value.length < total.value;
  } catch (err) {
    console.error('Failed to load MySQL files:', err);
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    stats.value = await apiFetch('/api/mysql/stats') || {};
  } catch {
    stats.value = {};
  }
}

function loadMore() {
  page.value += 1;
  void loadFiles();
}

function viewDetails(file) {
  selectedFile.value = file;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  try {
    return new Date(Number(timestamp)).toLocaleString();
  } catch {
    return '-';
  }
}

function truncateId(id) {
  if (!id) return '';
  return id.length > 30 ? `${id.slice(0, 15)}...${id.slice(-10)}` : id;
}
</script>

<style scoped>
.page-container {
  max-width: 1400px;
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

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--card-bg, rgba(255, 255, 255, 0.9));
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 12px;
  color: var(--text-color, #1f2937);
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

/* 工具栏 */
.toolbar-card {
  background: var(--card-bg, rgba(255, 255, 255, 0.9));
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
}

.toolbar-content {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  position: relative;
  min-width: 250px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 40px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.2));
  border-radius: 10px;
  background: var(--input-bg, #fff);
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color, #8a4bff);
}

.filter-select {
  padding: 12px 16px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.2));
  border-radius: 10px;
  background: var(--input-bg, #fff);
  font-size: 14px;
  cursor: pointer;
}

/* 表格卡片 */
.table-card {
  background: var(--card-bg, rgba(255, 255, 255, 0.9));
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  overflow: hidden;
  margin-bottom: 24px;
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: var(--table-header-bg, #f5f7fa);
  padding: 14px 16px;
  text-align: left;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted-color, #6b7280);
  font-weight: 600;
  border-bottom: 2px solid var(--border-color, rgba(0, 0, 0, 0.1));
}

.data-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
  font-size: 14px;
}

.table-row:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.02));
}

.id-code {
  background: var(--code-bg, #f5f7fa);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

.file-name {
  color: var(--text-color, #1f2937);
}

.storage-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.storage-badge.telegram { background: #e0f2fe; color: #0284c7; }
.storage-badge.r2 { background: #fef3c7; color: #d97706; }
.storage-badge.s3 { background: #fee2e2; color: #dc2626; }
.storage-badge.discord { background: #ede9fe; color: #7c3aed; }
.storage-badge.webdav { background: #d1fae5; color: #059669; }
.storage-badge.github { background: #f3f4f6; color: #4b5563; }

.folder-path {
  font-family: monospace;
  font-size: 12px;
  color: var(--muted-color, #6b7280);
}

.table-actions {
  display: flex;
  gap: 8px;
}

.empty-row {
  padding: 40px 20px;
}

.empty-cell {
  text-align: center;
}

.empty-cell .empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-cell p {
  color: var(--muted-color, #6b7280);
  margin: 0;
}

/* 分页 */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
}

.pagination-info {
  color: var(--muted-color, #6b7280);
  font-size: 14px;
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
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

.btn-icon {
  font-size: 14px;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg, #fff);
  border-radius: 16px;
  max-width: 700px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-color, #1f2937);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--muted-color, #6b7280);
  padding: 4px;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

.json-view {
  padding: 20px 24px;
  margin: 0;
  background: var(--code-bg, #f5f7fa);
  font-size: 13px;
  overflow: auto;
  max-height: 50vh;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  display: flex;
  justify-content: flex-end;
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
  .stat-card,
  .toolbar-card,
  .table-card,
  .modal-content {
    background: rgba(15, 23, 39, 0.9);
    border-color: rgba(130, 152, 196, 0.35);
  }
  
  .header-left h1 {
    color: #e8eeff;
  }
  
  .stat-value {
    color: #9aa9ff;
  }
  
  .search-input,
  .filter-select {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(130, 152, 196, 0.35);
    color: #e8eeff;
  }
  
  .data-table th {
    background: rgba(30, 41, 59, 0.8);
    color: #94a3b8;
  }
  
  .data-table td {
    border-color: rgba(130, 152, 196, 0.2);
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .toolbar-content {
    flex-direction: column;
  }
  
  .search-box {
    min-width: 100%;
  }
  
  .pagination-bar {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
}
</style>
