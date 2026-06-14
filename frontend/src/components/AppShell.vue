<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">⬡</span>
          <span v-if="!sidebarCollapsed" class="logo-text">特控tele</span>
        </div>
        <button class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          <span v-if="!sidebarCollapsed">◀</span>
          <span v-else>▶</span>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Main</div>
          <router-link to="/upload" class="nav-item" active-class="active">
            <span class="nav-icon">📤</span>
            <span v-if="!sidebarCollapsed" class="nav-text">Upload</span>
          </router-link>
          <router-link to="/drive" class="nav-item" active-class="active" v-if="authStore.authenticated">
            <span class="nav-icon">📁</span>
            <span v-if="!sidebarCollapsed" class="nav-text">Drive</span>
          </router-link>
        </div>

        <div class="nav-section" v-if="authStore.authenticated">
          <div class="nav-section-title">Storage</div>
          <router-link to="/storage" class="nav-item" active-class="active">
            <span class="nav-icon">💾</span>
            <span v-if="!sidebarCollapsed" class="nav-text">Storage Configs</span>
          </router-link>
          <router-link to="/mysql" class="nav-item" active-class="active">
            <span class="nav-icon">🗄️</span>
            <span v-if="!sidebarCollapsed" class="nav-text">MySQL</span>
          </router-link>
          <router-link to="/d1" class="nav-item" active-class="active">
            <span class="nav-icon">☁️</span>
            <span v-if="!sidebarCollapsed" class="nav-text">D1 Database</span>
          </router-link>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">System</div>
          <router-link to="/status" class="nav-item" active-class="active">
            <span class="nav-icon">📊</span>
            <span v-if="!sidebarCollapsed" class="nav-text">Status</span>
          </router-link>
          <a href="/legacy/index.html" class="nav-item" target="_blank" rel="noopener">
            <span class="nav-icon">🔄</span>
            <span v-if="!sidebarCollapsed" class="nav-text">Legacy UI</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div v-if="authStore.guestMode" class="guest-badge">
          <span>Guest Mode</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-wrapper">
      <!-- 顶部栏 -->
      <header class="topbar">
        <div class="topbar-left">
          <h2 class="page-title">{{ pageTitle }}</h2>
        </div>
        <div class="topbar-right">
          <button class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Switch to Light' : 'Switch to Dark'">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
          <router-link v-if="authStore.authRequired && !authStore.authenticated" class="btn btn-primary" to="/login">
            Login
          </router-link>
          <div v-if="authStore.authenticated" class="user-menu">
            <button class="btn btn-ghost" @click="handleLogout">Logout</button>
          </div>
        </div>
      </header>

      <!-- 访客提示 -->
      <section v-if="authStore.guestMode" class="guest-notice">
        <div class="notice-content">
          <strong>Guest mode enabled.</strong>
          <span>
            Max file size: {{ formatSize(authStore.guestUpload.maxFileSize) }},
            daily limit: {{ authStore.guestUpload.dailyLimit }} uploads.
          </span>
        </div>
      </section>

      <!-- 页面内容 -->
      <main class="page-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const sidebarCollapsed = ref(false);
const isDark = ref(document.documentElement.dataset.theme === 'dark');

const pageTitle = computed(() => {
  const titles = {
    upload: 'Upload Files',
    drive: 'File Manager',
    storage: 'Storage Configurations',
    mysql: 'MySQL Database',
    d1: 'D1 Database',
    status: 'System Status',
  };
  return titles[route.name] || '特控tele';
});

function formatSize(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light';
}

async function handleLogout() {
  try {
    await authStore.logout();
  } finally {
    router.push('/login');
  }
}
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-gradient, linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%));
}

/* 侧边栏样式 */
.sidebar {
  width: 240px;
  background: var(--card-bg, rgba(255, 255, 255, 0.95));
  border-right: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
}

.sidebar.collapsed {
  width: 70px;
}

.sidebar-header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
  color: var(--primary-color, #8a4bff);
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color, #8a4bff);
}

.collapse-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: var(--text-color, #333);
  font-size: 12px;
}

.collapse-btn:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

/* 导航样式 */
.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-section-title {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted-color, #6b7280);
  padding: 0 12px;
  margin-bottom: 8px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-color, #333);
  transition: all 0.2s ease;
  margin-bottom: 4px;
}

.nav-item:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

.nav-item.active {
  background: var(--primary-light, rgba(138, 75, 255, 0.1));
  color: var(--primary-color, #8a4bff);
  font-weight: 600;
}

.nav-icon {
  font-size: 18px;
  min-width: 24px;
  text-align: center;
}

.nav-text {
  font-size: 14px;
}

/* 侧边栏底部 */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
}

.guest-badge {
  padding: 8px 12px;
  background: var(--warning-bg, #fff3cd);
  border-radius: 6px;
  font-size: 12px;
  color: var(--warning-color, #856404);
  text-align: center;
  font-weight: 600;
}

/* 主内容区 */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部栏 */
.topbar {
  background: var(--card-bg, rgba(255, 255, 255, 0.95));
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color, #333);
  margin: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle {
  background: transparent;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.2));
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s ease;
}

.theme-toggle:hover {
  background: var(--hover-bg, rgba(0, 0, 0, 0.05));
}

/* 访客提示 */
.guest-notice {
  margin: 16px 24px;
  background: var(--warning-bg, #fff3cd);
  border-left: 4px solid var(--warning-color, #ffc107);
  border-radius: 8px;
  padding: 12px 16px;
}

.notice-content {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}

/* 页面内容 */
.page-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  .app-layout {
    background: linear-gradient(140deg, #111a2d 0%, #0b1120 55%, #070b16 100%);
  }
  
  .sidebar {
    background: rgba(15, 23, 39, 0.95);
    border-color: rgba(130, 152, 196, 0.35);
  }
  
  .nav-item {
    color: #e8eeff;
  }
  
  .page-title {
    color: #e8eeff;
  }
  
  .topbar {
    background: rgba(15, 23, 39, 0.95);
    border-color: rgba(130, 152, 196, 0.35);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar:not(.collapsed) {
    transform: translateX(0);
  }
  
  .main-wrapper {
    margin-left: 0;
  }
}
</style>
