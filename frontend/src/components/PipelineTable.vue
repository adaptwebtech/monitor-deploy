<script setup lang="ts">
import { ref } from "vue";
import type { PipelineQueue } from "../types";
import AvatarCell from "./AvatarCell.vue";
import StatusBadge from "./StatusBadge.vue";
import { useInfiniteScroll } from "../composables/useInfiniteScroll";

const props = defineProps<{
  pipelines: PipelineQueue[];
  hasMore?: boolean;
  loadingMore?: boolean;
}>();

const emit = defineEmits<{
  "sort-change": [field: string, order: string];
  "page-change": [page: number];
  loadMore: [];
}>();

const sentinel = ref<HTMLElement | null>(null);

useInfiniteScroll(sentinel, () => {
  if (props.hasMore && !props.loadingMore) {
    emit("loadMore");
  }
});
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
          data-test="pipeline-row"
          :data-row-id="pipeline.id"
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
          <td data-test="commit-message">
            <span
              class="d-inline-block text-truncate"
              style="max-width: 220px"
              :title="pipeline.commitMessage"
              >{{ pipeline.commitMessage }}</span
            >
          </td>
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

    <!-- Loading more indicator -->
    <div v-if="loadingMore" class="text-center py-3" data-test="loading-more">
      <div class="spinner-border spinner-border-sm text-primary" role="status">
        <span class="visually-hidden">Carregando mais...</span>
      </div>
    </div>

    <!-- Infinite scroll sentinel -->
    <div
      ref="sentinel"
      data-test="infinite-scroll-sentinel"
      style="height: 1px"
    ></div>
  </div>
</template>
