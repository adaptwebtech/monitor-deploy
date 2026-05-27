<template>
  <div class="d-flex flex-wrap gap-2 align-items-center">
    <input
      data-test="filter-app"
      type="text"
      class="form-control form-control-sm"
      style="max-width: 180px"
      placeholder="Filtrar por app"
      :value="store.filterApp"
      @input="onAppInput"
    />

    <select
      data-test="filter-environment"
      class="form-select form-select-sm"
      style="max-width: 180px"
      :value="store.filterEnvironment"
      @change="onEnvironmentChange"
    >
      <option value="">Todos os ambientes</option>
      <option value="development">development</option>
      <option value="staging">staging</option>
      <option value="production">production</option>
    </select>

    <select
      data-test="filter-status"
      class="form-select form-select-sm"
      style="max-width: 160px"
      :value="store.filterStatus"
      @change="onStatusChange"
    >
      <option value="">Todos os status</option>
      <option value="Queued">Queued</option>
      <option value="Running">Running</option>
      <option value="Completed">Completed</option>
      <option value="Failed">Failed</option>
    </select>

    <button
      v-if="store.hasActiveFilters"
      data-test="clear-filters"
      type="button"
      class="btn btn-sm btn-outline-secondary"
      @click="store.clearFilters()"
    >
      Limpar filtros
    </button>
  </div>
</template>

<script setup lang="ts">
import { useDashboardStore } from "../stores/dashboard.store";

const store = useDashboardStore();

function onAppInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  store.setFilters({ app: value });
}

function onEnvironmentChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  store.setFilters({ environment: value });
}

function onStatusChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  store.setFilters({ status: value });
}
</script>
