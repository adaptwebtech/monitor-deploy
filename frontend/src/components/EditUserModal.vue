<script setup lang="ts">
import { ref, watch } from 'vue'
import type { User } from '../types'
import { useUsersStore } from '../stores/users.store'

const props = defineProps<{ visible: boolean; user: User | null }>()
const emit = defineEmits<{ saved: [user: User]; closed: [] }>()

const usersStore = useUsersStore()

const name = ref('')
const email = ref('')
const githubId = ref('')
const profilePictureUrl = ref('')
const error = ref<string | null>(null)
const saving = ref(false)

watch(
  () => props.user,
  (u) => {
    if (u) {
      name.value = u.name
      email.value = u.email
      githubId.value = u.githubId ?? ''
      profilePictureUrl.value = u.profilePictureUrl ?? ''
    }
  },
  { immediate: true },
)

async function handleSave() {
  if (!props.user) return
  error.value = null
  saving.value = true
  try {
    const updated = await usersStore.updateUser(props.user.id, {
      name: name.value,
      email: email.value,
      githubId: githubId.value || null,
      profilePictureUrl: profilePictureUrl.value || null,
    })
    emit('saved', updated)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="modal d-block" tabindex="-1" data-test="edit-modal">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Editar Usuário</h5>
          <button type="button" class="btn-close" @click="emit('closed')"></button>
        </div>
        <div class="modal-body">
          <div v-if="error" class="alert alert-danger">{{ error }}</div>
          <div class="mb-3">
            <label class="form-label">Nome</label>
            <input v-model="name" type="text" class="form-control" data-test="edit-name" />
          </div>
          <div class="mb-3">
            <label class="form-label">E-mail</label>
            <input v-model="email" type="email" class="form-control" data-test="edit-email" />
          </div>
          <div class="mb-3">
            <label class="form-label">GitHub ID</label>
            <input v-model="githubId" type="text" class="form-control" data-test="edit-github-id" />
          </div>
          <div class="mb-3">
            <label class="form-label">URL da Foto</label>
            <input v-model="profilePictureUrl" type="url" class="form-control" data-test="edit-picture-url" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="emit('closed')">Cancelar</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="handleSave">
            <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
            Salvar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
