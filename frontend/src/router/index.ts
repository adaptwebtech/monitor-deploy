import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
  },
  {
    path: "/",
    name: "dashboard",
    component: () => import("../views/DashboardView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import("../views/ProfileView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/users",
    name: "users",
    component: () => import("../views/UsersView.vue"),
    meta: { requiresAuth: true, requiresRoot: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const token = localStorage.getItem("accessToken");
  if (to.meta.requiresAuth && !token) {
    return { name: "login" };
  }
  if (to.meta.requiresRoot) {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.root) {
      return { name: "dashboard" };
    }
  }
});

export default router;
