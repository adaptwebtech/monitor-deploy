<script setup lang="ts">
import { ref, onMounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import { useAuthStore } from "../stores/auth.store";
import { useProfileStore } from "../stores/profile.store";

const authStore = useAuthStore();
const profileStore = useProfileStore();

const name = ref(authStore.user?.name ?? "");
const email = ref(authStore.user?.email ?? "");
const githubId = ref(authStore.user?.githubId ?? "");
const profilePictureUrl = ref(authStore.user?.profilePictureUrl ?? "");

const saveError = ref<string | null>(null);
const saveSuccess = ref(false);
const saving = ref(false);

async function handleSave() {
  saveError.value = null;
  saveSuccess.value = false;
  saving.value = true;
  try {
    await authStore.updateProfile({
      name: name.value,
      email: email.value,
      githubId: githubId.value || null,
      profilePictureUrl: profilePictureUrl.value || null,
    });
    // Sync form with updated user
    if (authStore.user) {
      name.value = authStore.user.name;
      email.value = authStore.user.email;
      githubId.value = authStore.user.githubId ?? "";
      profilePictureUrl.value = authStore.user.profilePictureUrl ?? "";
    }
    saveSuccess.value = true;
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : "Erro ao salvar";
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  profileStore.fetchHistory();
});
</script>

<template>
  <AppLayout>
    <div class="container py-4">
      <h1 class="h3 mb-4">Meu Perfil</h1>

      <div class="card mb-5">
        <div class="card-body">
          <div
            v-if="saveError"
            class="alert alert-danger"
            data-test="save-error"
          >
            {{ saveError }}
          </div>
          <div
            v-if="saveSuccess"
            class="alert alert-success"
            data-test="save-success"
          >
            Perfil atualizado com sucesso!
          </div>

          <div class="mb-3">
            <label class="form-label">Nome</label>
            <input
              v-model="name"
              type="text"
              class="form-control"
              data-test="profile-name"
            />
          </div>

          <div class="mb-3">
            <label class="form-label">E-mail</label>
            <input
              v-model="email"
              type="email"
              class="form-control"
              data-test="profile-email"
            />
          </div>

          <div class="mb-3">
            <label class="form-label">GitHub ID</label>
            <input
              v-model="githubId"
              type="text"
              class="form-control"
              data-test="profile-github-id"
            />
          </div>

          <div class="mb-4">
            <label class="form-label">URL da Foto de Perfil</label>
            <input
              v-model="profilePictureUrl"
              type="url"
              class="form-control"
              data-test="profile-picture-url"
            />
          </div>

          <button
            type="button"
            class="btn btn-primary"
            data-test="profile-save"
            :disabled="saving"
            @click="handleSave"
          >
            <span
              v-if="saving"
              class="spinner-border spinner-border-sm me-2"
              role="status"
            ></span>
            Salvar
          </button>
        </div>
      </div>

      <!-- Pipeline History -->
      <h2 class="h4 mb-3">Histórico de Deploys</h2>
      <div v-if="profileStore.loading" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
      <div v-else-if="profileStore.error" class="alert alert-danger">
        {{ profileStore.error }}
      </div>
      <div v-else>
        <table class="table table-hover" data-test="history-table">
          <thead class="table-dark">
            <tr>
              <th>App</th>
              <th>Ambiente</th>
              <th>Commit</th>
              <th>Mensagem</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pipeline in profileStore.history"
              :key="pipeline.id"
              data-test="history-row"
            >
              <td>{{ pipeline.app }}</td>
              <td>{{ pipeline.environment }}</td>
              <td>
                <code>{{ pipeline.commitSha?.slice(0, 7) }}</code>
              </td>
              <td>{{ pipeline.commitMessage }}</td>
              <td>{{ pipeline.status }}</td>
              <td>
                {{ new Date(pipeline.createdAt).toLocaleDateString("pt-BR") }}
              </td>
            </tr>
            <tr v-if="profileStore.history.length === 0">
              <td
                colspan="6"
                class="text-center text-muted py-4"
                data-test="history-empty"
              >
                Nenhum deploy encontrado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AppLayout>
</template>
