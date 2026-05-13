<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";
import { useAuthStore } from "../stores/auth.store";
import { useUsersStore } from "../stores/users.store";
import type { User } from "../types";

const router = useRouter();
const authStore = useAuthStore();
const usersStore = useUsersStore();

const isRoot = computed(() => authStore.isRoot);

// Route guard
onMounted(async () => {
  if (!authStore.user?.root) {
    router.push("/");
    return;
  }
  await usersStore.fetchUsers({ del: "false", page: 1, limit: 10 });
});

const search = ref("");
const delFilter = ref("false");

// Edit modal state
const editModalVisible = ref(false);
const selectedUser = ref<User | null>(null);
const openMenuUserId = ref<string | null>(null);

function toggleMenu(userId: string) {
  if (openMenuUserId.value === userId) {
    openMenuUserId.value = null;
  } else {
    openMenuUserId.value = userId;
  }
}

function openEditModal(user: User) {
  selectedUser.value = user;
  editModalVisible.value = true;
  openMenuUserId.value = null;
}

function closeEditModal() {
  editModalVisible.value = false;
  selectedUser.value = null;
}

async function handleDelete(userId: string) {
  openMenuUserId.value = null;
  await usersStore.deleteUser(userId);
}

async function handleRegenerateToken(userId: string) {
  openMenuUserId.value = null;
  await usersStore.regenerateToken(userId);
}

async function handleSearch(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  search.value = value;
  await usersStore.fetchUsers({
    search: value,
    del: delFilter.value,
    page: 1,
    limit: 10,
  });
}

async function handleDelFilterChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  delFilter.value = value;
  await usersStore.fetchUsers({
    search: search.value,
    del: value,
    page: 1,
    limit: 10,
  });
}
</script>

<template>
  <AppLayout>
    <div class="container py-4">
      <h1 class="h3 mb-4">Usuários</h1>

      <!-- Filters -->
      <div class="d-flex gap-3 mb-4 flex-wrap">
        <input
          v-model="search"
          type="text"
          class="form-control"
          style="max-width: 300px"
          placeholder="Buscar por nome, e-mail ou GitHub ID"
          data-test="search"
          @input="handleSearch"
        />
        <select
          :value="delFilter"
          class="form-select"
          style="max-width: 200px"
          data-test="del-filter"
          @change="handleDelFilterChange"
        >
          <option value="false">Ativos</option>
          <option value="true">Excluídos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      <!-- Users Table -->
      <div v-if="usersStore.loading" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
      <div v-else-if="usersStore.error" class="alert alert-danger">
        {{ usersStore.error }}
      </div>
      <div v-else>
        <table class="table table-hover align-middle" data-test="users-table">
          <thead class="table-dark">
            <tr>
              <th style="width: 48px"></th>
              <th>Nome</th>
              <th>E-mail</th>
              <th>GitHub ID</th>
              <th v-if="isRoot" style="width: 60px"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in usersStore.users"
              :key="user.id"
              :data-test="'user-row-' + user.id"
            >
              <td>
                <div
                  style="
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    overflow: hidden;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: #6c757d;
                    color: white;
                    font-size: 14px;
                  "
                >
                  <img
                    v-if="user.profilePictureUrl"
                    :src="user.profilePictureUrl"
                    :alt="user.name"
                    style="width: 100%; height: 100%; object-fit: cover"
                  />
                  <span v-else>{{ user.name?.charAt(0)?.toUpperCase() }}</span>
                </div>
              </td>
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.githubId ?? "—" }}</td>
              <td v-if="isRoot" class="position-relative">
                <div class="dropdown">
                  <button
                    class="btn btn-sm btn-outline-secondary"
                    data-test="actions-menu"
                    @click="toggleMenu(user.id)"
                  >
                    [...]
                  </button>
                  <div
                    v-if="openMenuUserId === user.id"
                    class="dropdown-menu show position-absolute"
                    style="right: 0; top: 100%; z-index: 1000"
                  >
                    <button
                      class="dropdown-item"
                      data-test="edit-action"
                      @click="openEditModal(user)"
                    >
                      Editar
                    </button>
                    <button
                      class="dropdown-item"
                      data-test="regenerate-token-action"
                      @click="handleRegenerateToken(user.id)"
                    >
                      Regenerar Token
                    </button>
                    <button
                      class="dropdown-item text-danger"
                      data-test="delete-action"
                      @click="handleDelete(user.id)"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="usersStore.users.length === 0">
              <td
                :colspan="isRoot ? 5 : 4"
                class="text-center text-muted py-4"
                data-test="empty-state"
              >
                Nenhum usuário encontrado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Edit Modal -->
      <EditUserModal
        :visible="editModalVisible"
        :user="selectedUser"
        @saved="closeEditModal"
        @closed="closeEditModal"
      />
    </div>
  </AppLayout>
</template>
