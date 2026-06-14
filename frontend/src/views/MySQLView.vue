<template>
  <section class="card panel mysql-panel">
    <header class="panel-header">
      <div>
        <h2>MySQL Data</h2>
        <p class="muted">View synchronized file records from MySQL database.</p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-ghost" @click="refreshAll">Refresh</button>
      </div>
    </header>

    <div v-if="!mysqlEnabled" class="mysql-disabled card-lite">
      <p class="error">MySQL is not configured. Set MYSQL_HOST and MYSQL_DATABASE environment variables to enable.</p>
    </div>

    <template v-else>
      <section class="mysql-stats card-lite">
        <div class="stat-card">
          <span class="stat-value">{{ stats.total || 0 }}</span>
          <span class="stat-label">Total Files</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ formatSize(stats.totalSize || 0) }}</span>
          <span class="stat-label">Total Size</span>
        </div>
        <div class="stat-card" v-for="(count, type) in stats.byStorage" :key="type">
          <span class="stat-value">{{ count }}</span>
          <span class="stat-label">{{ type }}</span>
        </div>
      </section>

      <section class="mysql-toolbar card-lite">
        <div class="toolbar">
          <input v-model.trim="search" placeholder="Search files..." @keyup.enter="loadFiles" />
          <select v-model="storageFilter" @change="loadFiles">
            <option value="all">All Storage</option>
            <option value="telegram">Telegram</option>
            <option value="r2">R2</option>
            <option value="s3">S3</option>
            <option value="discord">Discord</option>
            <option value="webdav">WebDAV</option>
            <option value="github">GitHub</option>
          </select>
        </div>
      </section>

      <div class="table-wrap">
        <table class="table">
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
            <tr v-for="file in files" :key="file.id">
              <td><small class="muted">{{ truncateId(file.id) }}</small></td>
              <td><strong>{{ file.file_name }}</strong></td>
              <td><span class="badge">{{ file.storage_type }}</span></td>
              <td>{{ formatSize(file.file_size) }}</td>
              <td><small>{{ file.folder_path || '/' }}</small></td>
              <td>{{ formatTime(file.created_at) }}</td>
              <td>
                <div class="table-actions">
                  <a class="btn btn-ghost" :href="`/file/${encodeURIComponent(file.id)}`" target="_blank">Open</a>
                  <button class="btn btn-ghost" @click="viewDetails(file)">Details</button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && files.length === 0">
              <td colspan="7" class="empty">No files in MySQL database.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="footer-actions">
        <button class="btn" :disabled="loading || !hasMore" @click="loadMore">
          {{ loading ? 'Loading...' : 'Load More' }}
        </button>
        <span class="muted">{{ files.length }} / {{ total }} files</span>
      </div>
    </template>

    <div v-if="selectedFile" class="modal-overlay" @click.self="selectedFile = null">
      <div class="modal-content">
        <h3>File Details</h3>
        <pre class="json-view">{{ JSON.stringify(selectedFile, null, 2) }}</pre>
        <div class="modal-actions">
          <button class="btn" @click="selectedFile = null">Close</button>
        </div>
      </div>
    </div>
  </section>
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
.mysql-panel {
  max-width: 1200px;
  margin: 0 auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.panel-header h2 {
  margin: 0 0 4px;
}

.mysql-disabled {
  padding: 20px;
  text-align: center;
}

.mysql-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 120px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color, #0f766e);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--muted-color, #6b7280);
  margin-top: 4px;
}

.mysql-toolbar {
  margin-bottom: 16px;
}

.toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar input {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
}

.toolbar select {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
}

.table th {
  font-weight: 600;
  color: var(--muted-color, #6b7280);
  font-size: 0.85rem;
}

.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(15, 118, 110, 0.15);
  color: var(--primary-color, #0f766e);
  font-size: 0.75rem;
  font-weight: 600;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.footer-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 16px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--surface-color, #fff);
  border-radius: 16px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
}

.json-view {
  background: rgba(0, 0, 0, 0.05);
  padding: 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  overflow-x: auto;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
