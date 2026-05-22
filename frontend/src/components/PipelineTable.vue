<script setup lang="ts">
import { computed } from "vue";
import type { PipelineQueue } from "../types";
import AvatarCell from "./AvatarCell.vue";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{
  pipelines: PipelineQueue[];
  total: number;
  page: number;
  limit: number;
}>();

const emit = defineEmits<{
  "update:page": [page: number];
  "update:limit": [limit: number];
}>();

const totalPages = computed(() =>
  props.total === 0 ? 0 : Math.ceil(props.total / props.limit),
);

const rangeStart = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.limit + 1,
);

const rangeEnd = computed(() =>
  props.total === 0 ? 0 : Math.min(props.page * props.limit, props.total),
);

const isPrevDisabled = computed(
  () => props.page <= 1 || props.total === 0,
);

const isNextDisabled = computed(
  () => props.page >= totalPages.value || props.total === 0,
);

function onPrev() {
  emit("update:page", props.page - 1);
}

function onNext() {
  emit("update:page", props.page + 1);
}

function onLimitChange(event: Event) {
  emit("update:limit", Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
  <div class="table-responsive">
    <table class="table table-hover align-middle">
      <thead class="table-dark">
        <tr>
          <th style="width: 48px"></th>
          <th>Autor</th>
          <th>App</th>
          <th>Ambiente</th>
          <th>Commit</th>
          <th>Mensagem</th>
          <th>Data</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="pipeline in pipelines"
          :key="pipeline.id"
          :data-test="'row-' + pipeline.id"
        >
          <td data-test="avatar-cell">
            <AvatarCell
              :url="pipeline.commitAuthorAvatar"
              :name="pipeline.commitAuthor"
            />
          </td>
          <td data-test="commit-author">{{ pipeline.commitAuthor }}</td>
          <td data-test="app">{{ pipeline.app }}</td>
          <td data-test="environment">
            {{ pipeline.environment }}
            <div
              v-if="pipeline.currentStep"
              class="text-muted small text-truncate"
              style="max-width: 160px"
              :title="pipeline.currentStep"
            >
              {{ pipeline.currentStep }}
            </div>
          </td>
          <td data-test="commit-sha">
            <code>{{ pipeline.commitSha?.slice(0, 7) }}</code>
          </td>
          <td data-test="commit-message">{{ pipeline.commitMessage }}</td>
          <td data-test="created-at" class="text-nowrap text-muted small">
            {{
              new Date(pipeline.createdAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })
            }}
          </td>
          <td data-test="status">
            <StatusBadge :status="pipeline.status" />
          </td>
        </tr>
        <tr v-if="pipelines.length === 0">
          <td
            colspan="8"
            class="text-center text-muted py-4"
            data-test="empty-state"
          >
            Nenhum deploy encontrado neste período.
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination footer -->
    <div class="d-flex align-items-center justify-content-between mt-2 gap-2">
      <span data-test="pagination-range" class="text-muted small">
        <template v-if="total === 0">Mostrando 0 de 0</template>
        <template v-else>Mostrando {{ rangeStart }}–{{ rangeEnd }} de {{ total }}</template>
      </span>

      <div class="d-flex align-items-center gap-2">
        <button
          data-test="btn-prev"
          class="btn btn-outline-secondary btn-sm"
          :disabled="isPrevDisabled"
          @click="onPrev"
        >
          Anterior
        </button>
        <button
          data-test="btn-next"
          class="btn btn-outline-secondary btn-sm"
          :disabled="isNextDisabled"
          @click="onNext"
        >
          Próximo
        </button>
        <select
          data-test="select-limit"
          class="form-select form-select-sm"
          style="width: auto"
          :value="limit"
          @change="onLimitChange"
        >
          <option :value="10">10</option>
          <option :value="100">100</option>
        </select>
      </div>
    </div>
  </div>
</template>
