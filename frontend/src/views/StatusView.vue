<template>
  <div class="page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <h1>📊 System Status</h1>
          <p>Storage availability, diagnostics, and self-check tools</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" @click="loadStatus" :disabled="loading">
            <span class="btn-icon">{{ loading ? '⏳' : '🔄' }}</span>
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading system status...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">❌</div>
      <h3>Failed to Load Status</h3>
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="loadStatus">Retry</button>
    </div>

    <!-- 正常状态 -->
    <template v-else>
      <!-- 存储适配器网格 -->
      <div class="stats-grid">
        <div 
          v-for="item in adapters" 
          :key="item.type" 
          class="stat-card adapter-card"
          :class="{ available: item.connected, unavailable: !item.connected }"
        >
          <div class="stat-icon">{{ getAdapterIcon(item.type) }}</div>
          <div class="stat-value">{{ item.label }}</div>
          <div class="stat-label">
            <span class="status-badge" :class="item.connected ? 'connected' : 'unavailable'">
              {{ item.connected ? 'Connected' : 'Unavailable' }}
            </span>
          </div>
          <div class="adapter-details">
            <p>Configured: <strong>{{ item.configured ? 'Yes' : 'No' }}</strong></p>
            <p>Layer: <strong>{{ item.layer }}</strong></p>
            <p v-if="item.errorMessage" class="error-text">⚠️ {{ item.errorMessage }}</p>
          </div>
        </div>
      </div>

      <!-- Telegram 诊断 -->
      <div v-if="telegramDiag" class="section-card diagnostic-card">
        <div class="section-header">
          <h2>🤖 Telegram Diagnostics</h2>
          <p>{{ telegramDiag.summary }}</p>
        </div>
        <div class="section-content">
          <div class="diag-grid">
            <div class="diag-item">
              <span class="diag-label">Config source:</span>
              <span class="diag-value">{{ telegramDiag.configSource || 'unknown' }}</span>
            </div>
            <div class="diag-item">
              <span class="diag-label">Bot token source:</span>
              <span class="diag-value">{{ telegramDiag.tokenSource || 'not found' }}</span>
            </div>
            <div class="diag-item">
              <span class="diag-label">Chat ID source:</span>
              <span class="diag-value">{{ telegramDiag.chatIdSource || 'not found' }}</span>
            </div>
            <div class="diag-item">
              <span class="diag-label">API base source:</span>
              <span class="diag-value">{{ telegramDiag.apiBaseSource || 'default' }}</span>
            </div>
          </div>

          <div class="troubleshoot-steps">
            <h3>Troubleshooting Steps:</h3>
            <ol>
              <li>Call <code>/api/status</code> and verify Telegram <code>message</code> and <code>errorModel.detail</code> fields.</li>
              <li>Check Docker env values for the effective aliases shown above.</li>
              <li>If token/chat is valid but still timeout, inspect VPS outbound network to Telegram API.</li>
            </ol>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '../api/client';

const loading = ref(false);
const error = ref('');
const status = ref(null);

const adapters = computed(() => {
  const source = status.value || {};
  const list = Array.isArray(source.capabilities) ? source.capabilities : [];
  return list.map((cap) => {
    const detail = source[cap.type] || {};
    const errorMessage = detail.errorModel?.detail || '';
    return {
      type: cap.type,
      label: cap.label,
      connected: Boolean(detail.connected),
      configured: Boolean(detail.configured),
      layer: cap.layer || detail.layer || 'direct',
      message: detail.message || cap.enableHint || 'No data',
      errorMessage,
    };
  });
});

const telegramDiag = computed(() => status.value?.diagnostics?.telegram || null);

onMounted(() => {
  void loadStatus();
});

async function loadStatus() {
  loading.value = true;
  error.value = '';
  try {
    status.value = await apiFetch('/api/status');
  } catch (err) {
    error.value = err.message || 'Failed to load status';
  } finally {
    loading.value = false;
  }
}

function getAdapterIcon(type) {
  const icons = {
    telegram: '📱',
    r2: '🗂️',
    s3: '☁️',
    discord: '🎮',
    huggingface: '🤗',
    webdav: '📡',
    github: '🐙',
    mysql: '🗄️',
    d1: '📊',
  };
  return icons[type] || '💾';
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

/* 加载和错误状态 */
.loading-state,
.error-state {
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

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-state h3 {
  margin: 0 0 12px;
  color: var(--error-color, #dc2626);
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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

.stat-card.available {
  border-left: 4px solid var(--success-color, #059669);
}

.stat-card.unavailable {
  border-left: 4px solid var(--error-color, #dc2626);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-color, #1f2937);
  margin-bottom: 8px;
}

.stat-label {
  margin-bottom: 12px;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.connected {
  background: var(--success-bg, #d1fae5);
  color: var(--success-color, #059669);
}

.status-badge.unavailable {
  background: var(--error-bg, #fee2e2);
  color: var(--error-color, #dc2626);
}

.adapter-details {
  text-align: left;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
}

.adapter-details p {
  margin: 8px 0;
  font-size: 14px;
  color: var(--muted-color, #6b7280);
}

.error-text {
  color: var(--error-color, #dc2626);
  font-weight: 500;
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

/* 诊断网格 */
.diag-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.diag-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background: var(--code-bg, #f5f7fa);
  border-radius: 8px;
}

.diag-label {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--muted-color, #6b7280);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.diag-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #1f2937);
  font-family: monospace;
}

/* 排障步骤 */
.troubleshoot-steps h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: var(--text-color, #1f2937);
}

.troubleshoot-steps ol {
  margin: 0;
  padding-left: 20px;
}

.troubleshoot-steps li {
  margin: 8px 0;
  font-size: 14px;
  color: var(--muted-color, #6b7280);
}

.troubleshoot-steps code {
  background: var(--code-bg, #e5e7eb);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
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

.btn-icon {
  font-size: 16px;
}

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
  .diag-value {
    color: #e8eeff;
  }
  
  .diag-item {
    background: rgba(30, 41, 59, 0.8);
  }
  
  .troubleshoot-steps code {
    background: rgba(30, 41, 59, 0.8);
    color: #e8eeff;
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .diag-grid {
    grid-template-columns: 1fr;
  }
  
  .header-content {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
