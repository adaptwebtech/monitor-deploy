<script setup lang="ts">
import type { PipelineQueue } from "../types";
import AvatarCell from "./AvatarCell.vue";
import StatusBadge from "./StatusBadge.vue";

defineProps<{ pipelines: PipelineQueue[] }>();
defineEmits<{
  "sort-change": [field: string, order: string];
  "page-change": [page: number];
}>();
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
          <td data-test="environment">{{ pipeline.environment }}</td>
          <td data-test="commit-sha">
            <code>{{ pipeline.commitSha?.slice(0, 7) }}</code>
          </td>
          <td data-test="commit-message">{{ pipeline.commitMessage }}</td>
          <td data-test="created-at" class="text-nowrap text-muted small">
            {{ new Date(pipeline.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }}
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
  </div>
</template>
