import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PipelineQueue } from '../types'

export const useProfileStore = defineStore('profile', () => {
  const history = ref<PipelineQueue[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchHistory() {
    loading.value = true
    error.value = null
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${window.config.API_URL}/pipeline-queue/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      history.value = data.data ?? data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error'
    } finally {
      loading.value = false
    }
  }

  return { history, loading, error, fetchHistory }
})
