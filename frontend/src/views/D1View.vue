<template>
  <section class="card panel d1-panel">
    <header class="panel-header">
      <div>
        <h2>D1 Database</h2>
        <p class="muted">Manage Cloudflare D1 database migration and synchronization.</p>
      </div>
      <div class="panel-actions">
        <button class="btn btn-ghost" @click="refreshStatus">Refresh</button>
      </div>
    </header>

    <!-- D1 Status Card -->
    <div v-if="loading" class="loading-card">
      <p>Loading D1 status...</p>
    </div>

    <template v-else>
      <div v-if="!status.available" class="d1-disabled card-lite">
        <p class="error">D1 is not configured. Set up D1 binding and environment variables to enable.</p>
        <pre class="config-hint">{{ status.reason || 'D1 binding missing' }}</pre>
      </div>

      <template v-else>
        <section class="d1-stats card-lite">
          <div class="stat-card">
            <span class="stat-value">{{ status.stats?.fileCount || 0 }}</span>
            <span class="stat-label">Files in D1</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ status.stats?.storageCount || 0 }}</span>
            <span class="stat-label">Storage Configs</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ status.health?.type }}</span>
            <span class="stat-label">Primary Backend</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ status.stats?.kvFileCount || 'N/A' }}</span>
            <span class="stat-label">KV Status</span>
          </div>
        </section>

        <!-- Migration Section -->
        <section class="d1-section card-lite">
          <h3>Migration (KV → D1)</h3>
          <p class="muted">Migrate existing metadata from KV to D1 database.</p>
          
          <div class="action-row">
            <button 
              class="btn btn-primary" 
              :disabled="migrating"
              @click="startMigration"
            >
              {{ migrating ? 'Migrating...' : 'Start Migration' }}
            </button>
            <span v-if="migrationResult" class="result-text">
              Migrated: {{ migrationResult.totalMigrated }}, 
              Skipped: {{ migrationResult.totalSkipped }}, 
              Failed: {{ migrationResult.totalFailed }}
            </span>
          </div>

          <div v-if="migrating" class="progress-bar">
            <div class="progress-fill" :style="{ width: `${migrationProgress}%` }"></div>
          </div>
        </section>

        <!-- Sync Section -->
        <section class="d1-section card-lite">
          <h3>Sync & Repair</h3>
          <p class="muted">Compare KV and D1 data, fix inconsistencies.</p>
          
          <div class="action-row">
            <button class="btn" @click="checkDiff">Check Differences</button>
            <button 
              class="btn btn-secondary" 
              :disabled="syncing || !diffResult"
              @click="startSync"
            >
              {{ syncing ? 'Syncing...' : 'Sync KV → D1' }}
            </button>
          </div>

          <div v-if="diffResult" class="diff-report">
            <div class="diff-item">
              <strong>Missing in D1:</strong> {{ diffResult.missing.length }} files
            </div>
            <div class="diff-item">
              <strong>Outdated in D1:</strong> {{ diffResult.outdated.length }} files
            </div>
            <div class="diff-item">
              <strong>KV Total:</strong> {{ diffResult.kvCount }} | 
              <strong>D1 Total:</strong> {{ diffResult.d1Count }}
            </div>
          </div>

          <div v-if="syncResult" class="sync-result">
            Synced: {{ syncResult.synced }}, Failed: {{ syncResult.failed }}
          </div>
        </section>
      </template>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const status = ref({ available: false, stats: {}, health: {} });
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
.d1-panel {
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

.loading-card,
.d1-disabled {
  padding: 24px;
  text-align: center;
}

.config-hint {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  font-size: 0.85rem;
}

.d1-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  min-width: 140px;
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

.d1-section {
  padding: 20px;
  margin-bottom: 16px;
}

.d1-section h3 {
  margin: 0 0 8px;
}

.action-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
  flex-wrap: wrap;
}

.result-text,
.sync-result {
  font-size: 0.9rem;
  color: var(--success-color, #059669);
}

.progress-bar {
  margin-top: 12px;
  height: 8px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color, #0f766e);
  transition: width 0.3s ease;
}

.diff-report {
  margin-top: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 3px solid var(--warning-color, #d97706);
}

.diff-item {
  margin: 8px 0;
  font-size: 0.9rem;
}

.error {
  color: var(--error-color, #dc2626);
  font-weight: 600;
}

.muted {
  color: var(--muted-color, #6b7280);
  font-size: 0.85rem;
}
</style>
