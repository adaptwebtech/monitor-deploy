<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const errorMsg = ref<string | null>(null)
const loading = ref(false)

async function handleSubmit() {
  errorMsg.value = null
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Erro ao fazer login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container-fluid min-vh-100 d-flex p-0">
    <!-- Left image column — hidden on mobile -->
    <div
      class="d-none d-md-flex col-md-6 align-items-center justify-content-center bg-primary"
      data-test="login-image"
    >
      <div class="text-white text-center p-4">
        <h2 class="display-5 fw-bold">Pipeline Monitor</h2>
        <p class="lead">Acompanhe seus deploys em tempo real</p>
      </div>
    </div>

    <!-- Right form column -->
    <div class="col-12 col-md-6 d-flex align-items-center justify-content-center">
      <div class="w-100" style="max-width: 400px; padding: 2rem;">
        <h1 class="h3 mb-4 fw-bold">Entrar</h1>

        <div v-if="errorMsg" class="alert alert-danger" data-test="error" role="alert">
          {{ errorMsg }}
        </div>

        <div class="mb-3">
          <label for="email" class="form-label">E-mail</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-control"
            placeholder="seu@email.com"
            data-test="email"
            autocomplete="email"
          />
        </div>

        <div class="mb-4">
          <label for="password" class="form-label">Senha</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control"
            placeholder="••••••••"
            data-test="password"
            autocomplete="current-password"
            @keyup.enter="handleSubmit"
          />
        </div>

        <button
          type="button"
          class="btn btn-primary w-100"
          data-test="submit"
          :disabled="loading"
          @click="handleSubmit"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
          Entrar
        </button>
      </div>
    </div>
  </div>
</template>
