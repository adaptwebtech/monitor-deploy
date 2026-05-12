<script setup lang="ts">
import { ref } from 'vue'
import { useDashboardStore } from '../stores/dashboard.store'

const store = useDashboardStore()

const now = new Date()
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

const dateStart = ref(sevenDaysAgo.toISOString().slice(0, 10))
const dateEnd = ref(now.toISOString().slice(0, 10))

function applyFilter() {
  store.setDateRange(
    new Date(dateStart.value).toISOString(),
    new Date(dateEnd.value + 'T23:59:59').toISOString(),
  )
}
</script>

<template>
  <div class="d-flex gap-2 align-items-center flex-wrap" data-test="date-filter">
    <input
      v-model="dateStart"
      type="date"
      class="form-control form-control-sm"
      data-test="date-start"
      style="width: 160px;"
    />
    <span>até</span>
    <input
      v-model="dateEnd"
      type="date"
      class="form-control form-control-sm"
      data-test="date-end"
      style="width: 160px;"
    />
    <button class="btn btn-sm btn-outline-primary" @click="applyFilter">Filtrar</button>
  </div>
</template>
