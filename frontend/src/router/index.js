import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AppShell from '../components/AppShell.vue';
import LoginView from '../views/LoginView.vue';
import UploadView from '../views/UploadView.vue';
import DriveView from '../views/DriveView.vue';
import StorageView from '../views/StorageView.vue';
import StatusView from '../views/StatusView.vue';
import MySQLView from '../views/MySQLView.vue';
import D1View from '../views/D1View.vue';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true },
  },
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', redirect: '/upload' },
      { path: 'upload', name: 'upload', component: UploadView },
      { path: 'drive', name: 'drive', component: DriveView, meta: { requiresAdmin: true } },
      { path: 'admin', name: 'admin', component: DriveView, meta: { requiresAdmin: true } },
      { path: 'storage', name: 'storage', component: StorageView, meta: { requiresAdmin: true } },
      { path: 'mysql', name: 'mysql', component: MySQLView, meta: { requiresAdmin: true } },
      { path: 'd1', name: 'd1', component: D1View, meta: { requiresAdmin: true } },
      { path: 'status', name: 'status', component: StatusView },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/upload' },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  if (!authStore.initialized) {
    try {
      await authStore.refresh();
    } catch {
      // Auth check failed, continue with defaults
    }
  }

  if (to.name === 'login') {
    if (!authStore.authRequired || authStore.authenticated) {
      const rawTarget = typeof to.query.redirect === 'string' ? to.query.redirect : '/upload';
      const target = rawTarget === '/' ? '/upload' : rawTarget;
      return target;
    }
    return true;
  }

  if (to.meta.requiresAdmin && authStore.authRequired && !authStore.authenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  return true;
});

export default router;
