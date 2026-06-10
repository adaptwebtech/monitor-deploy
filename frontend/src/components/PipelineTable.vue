<script lang="ts">
export function stripMergeLine(msg: string): string {
  if (!msg) return msg;
  const lines = msg.split("\n");
  if (/^Merge pull request #\d+ from .+/.test(lines[0])) {
    let rest = lines.slice(1);
    while (rest.length > 0 && rest[0].trim() === "") {
      rest = rest.slice(1);
    }
    return rest.join("\n").trim();
  }
  return msg;
}
</script>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { PipelineQueue } from "../types";
import AvatarCell from "./AvatarCell.vue";
import StatusBadge from "./StatusBadge.vue";
import { useInfiniteScroll } from "../composables/useInfiniteScroll";
import { useGithubUsersStore } from "../stores/github-users.store";

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
const githubUsersStore = useGithubUsersStore();

useInfiniteScroll(sentinel, () => {
  if (props.hasMore && !props.loadingMore) {
    emit("loadMore");
  }
});

watch(
  () => props.pipelines,
  (pipelines) => {
    const ids = pipelines
      .map((p) => p.commitAuthorId)
      .filter((id): id is string => !!id);
    const unique = [...new Set(ids)];
    if (unique.length) {
      githubUsersStore.resolveIds(unique);
    }
  },
  { immediate: true },
);

function resolvedAvatarUrl(pipeline: PipelineQueue): string | null {
  const user = githubUsersStore.getResolved(pipeline.commitAuthorId);
  if (user && user.profilePictureUrl) return user.profilePictureUrl;
  return pipeline.commitAuthorAvatar ?? null;
}

function resolvedAuthorName(pipeline: PipelineQueue): string {
  const user = githubUsersStore.getResolved(pipeline.commitAuthorId);
  return user?.name ?? pipeline.commitAuthor;
}

const normalizeCommitMessage = stripMergeLine;
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
          <th>Criado</th>
          <th data-test="col-header-started-at">Início</th>
          <th data-test="col-header-finalized-at">Fim</th>
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
          <td>
            <AvatarCell
              :url="resolvedAvatarUrl(pipeline)"
              :name="resolvedAuthorName(pipeline)"
            />
          </td>
          <td data-test="author-name">{{ resolvedAuthorName(pipeline) }}</td>
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
              :title="normalizeCommitMessage(pipeline.commitMessage)"
              >{{ normalizeCommitMessage(pipeline.commitMessage) }}</span
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
          <td data-test="started-at" class="text-nowrap text-muted small">
            {{
              pipeline.startedAt
                ? new Date(pipeline.startedAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "–"
            }}
          </td>
          <td data-test="finalized-at" class="text-nowrap text-muted small">
            {{
              pipeline.finalizedAt
                ? new Date(pipeline.finalizedAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "–"
            }}
          </td>
          <td data-test="status">
            <StatusBadge :status="pipeline.status" />
          </td>
        </tr>
        <tr v-if="pipelines.length === 0">
          <td
            colspan="10"
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
