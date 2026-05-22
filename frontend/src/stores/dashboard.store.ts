import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { PipelineQueue, KpiStats } from "../types";
import { apiFetch } from "../lib/apiFetch";

export const useDashboardStore = defineStore("dashboard", () => {
  const pipelines = ref<PipelineQueue[]>([]);
  const kpis = ref<KpiStats>({
    total: 0,
    succeeded: 0,
    failed: 0,
    errorRate: 0,
  });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const dateStart = ref<string>("");
  const dateEnd = ref<string>("");

  // Pagination state
  const page = ref(1);
  const limit = ref(10);
  const total = ref(0);

  const runningPipeline = computed(
    () => pipelines.value.find((p) => p.status === "Running") ?? null,
  );

  async function fetchPipelines(start: string, end: string) {
    loading.value = true;
    error.value = null;
    try {
      const url = `${window.config.API_URL}/pipeline-queue?dateStart=${encodeURIComponent(start)}&dateEnd=${encodeURIComponent(end)}&page=${page.value}&limit=${limit.value}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      pipelines.value = data.data ?? data;
      total.value = data.total ?? 0;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error";
    } finally {
      loading.value = false;
    }
  }

  async function fetchKpis(start: string, end: string) {
    const url = `${window.config.API_URL}/dashboard/kpis?dateStart=${encodeURIComponent(start)}&dateEnd=${encodeURIComponent(end)}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    kpis.value = await res.json();
  }

  function handleSocketUpdated(pipeline: PipelineQueue) {
    const idx = pipelines.value.findIndex((p) => p.id === pipeline.id);
    if (idx !== -1) {
      pipelines.value.splice(idx, 1, { ...pipelines.value[idx], ...pipeline });
    }
  }

  function setDateRange(start: string, end: string) {
    dateStart.value = start;
    dateEnd.value = end;
    page.value = 1;
    fetchPipelines(start, end);
    fetchKpis(start, end);
  }

  async function setPage(n: number) {
    page.value = n;
    const self = useDashboardStore();
    await self.fetchPipelines(dateStart.value, dateEnd.value);
  }

  async function setLimit(n: number) {
    limit.value = n;
    page.value = 1;
    const self = useDashboardStore();
    await self.fetchPipelines(dateStart.value, dateEnd.value);
  }

  async function handleSocketCreated(_pipeline: PipelineQueue) {
    page.value = 1;
    const self = useDashboardStore();
    await self.fetchPipelines(dateStart.value, dateEnd.value);
  }

  return {
    pipelines,
    kpis,
    loading,
    error,
    dateStart,
    dateEnd,
    page,
    limit,
    total,
    runningPipeline,
    fetchPipelines,
    fetchKpis,
    handleSocketCreated,
    handleSocketUpdated,
    setDateRange,
    setPage,
    setLimit,
  };
});
