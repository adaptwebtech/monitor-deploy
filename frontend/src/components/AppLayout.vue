<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.store";

const auth = useAuthStore();
const router = useRouter();

function handleLogout() {
  auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="d-flex min-vh-100">
    <!-- Side menu (desktop) -->
    <nav
      class="d-none d-md-flex flex-column bg-dark text-white p-3"
      style="width: 220px; min-height: 100vh; position: fixed; top: 0; left: 0"
      data-test="side-menu"
    >
      <div class="fw-bold mb-4 fs-5">Pipeline Monitor</div>
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="text-white text-decoration-none mb-2 py-1 px-2 rounded"
        data-test="dashboard-link"
      >
        Dashboard
      </RouterLink>
      <RouterLink
        :to="{ name: 'profile' }"
        class="text-white text-decoration-none mb-2 py-1 px-2 rounded"
        data-test="profile-link"
      >
        Perfil
      </RouterLink>
      <RouterLink
        v-if="auth.isRoot"
        :to="{ name: 'users' }"
        class="text-white text-decoration-none mb-2 py-1 px-2 rounded"
        data-test="users-link"
      >
        Usuários
      </RouterLink>
      <button
        class="text-danger text-decoration-none mb-2 py-1 px-2 rounded bg-transparent border-0 text-start"
        data-test="logout-button"
        @click="handleLogout"
      >
        Sair
      </button>
    </nav>

    <!-- Main content -->
    <main
      class="flex-grow-1"
      style="margin-left: 0"
      :style="{ marginLeft: '220px' }"
    >
      <slot />
    </main>

    <!-- Bottom menu (mobile) -->
    <nav
      class="d-flex d-md-none fixed-bottom bg-dark text-white justify-content-around p-2"
      data-test="bottom-menu"
    >
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="text-white text-decoration-none"
        data-test="dashboard-link"
      >
        Dashboard
      </RouterLink>
      <RouterLink
        :to="{ name: 'profile' }"
        class="text-white text-decoration-none"
        data-test="profile-link"
      >
        Perfil
      </RouterLink>
      <RouterLink
        v-if="auth.isRoot"
        :to="{ name: 'users' }"
        class="text-white text-decoration-none"
        data-test="users-link"
      >
        Usuários
      </RouterLink>
      <button
        class="text-danger text-decoration-none bg-transparent border-0"
        data-test="logout-button"
        @click="handleLogout"
      >
        Sair
      </button>
    </nav>
  </div>
</template>
