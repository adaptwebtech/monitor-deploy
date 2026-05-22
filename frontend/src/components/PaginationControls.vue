<script setup lang="ts">
const props = defineProps<{
  page: number;
  totalPages: number;
  limit: 10 | 100;
  orderBy: "desc" | "asc";
}>();

const emit = defineEmits<{
  pageChange: [n: number];
  limitChange: [n: 10 | 100];
  orderChange: [o: "desc" | "asc"];
}>();

function onPrev() {
  if (props.page > 1) {
    emit("pageChange", props.page - 1);
  }
}

function onNext() {
  if (props.page < props.totalPages) {
    emit("pageChange", props.page + 1);
  }
}

function onLimitChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value) as 10 | 100;
  emit("limitChange", value);
}

function onOrderChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as "desc" | "asc";
  emit("orderChange", value);
}
</script>

<template>
  <div class="d-flex align-items-center gap-3 flex-wrap">
    <button
      class="btn btn-outline-secondary btn-sm"
      data-test="pagination-prev"
      :disabled="page === 1"
      @click="onPrev"
    >
      &laquo; Anterior
    </button>

    <span data-test="pagination-page-info" class="text-muted small">
      Página {{ page }} de {{ totalPages }}
    </span>

    <button
      class="btn btn-outline-secondary btn-sm"
      data-test="pagination-next"
      :disabled="page === totalPages"
      @click="onNext"
    >
      Próxima &raquo;
    </button>

    <div class="d-flex align-items-center gap-2">
      <label class="form-label mb-0 small">Por página:</label>
      <select
        class="form-select form-select-sm"
        style="width: auto"
        data-test="pagination-limit-select"
        :value="limit"
        @change="onLimitChange"
      >
        <option value="10">10</option>
        <option value="100">100</option>
      </select>
    </div>

    <div class="d-flex align-items-center gap-2">
      <label class="form-label mb-0 small">Ordem:</label>
      <select
        class="form-select form-select-sm"
        style="width: auto"
        data-test="pagination-order-select"
        :value="orderBy"
        @change="onOrderChange"
      >
        <option value="desc">Mais recentes</option>
        <option value="asc">Mais antigas</option>
      </select>
    </div>
  </div>
</template>
