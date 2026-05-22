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

  // dateRange object for patch-based usage (AC-15)
  const dateRange = ref<{ dateStart: string; dateEnd: string }>({
    dateStart: "",
    dateEnd: "",
  });

  // Infinite scroll state
  const page = ref(1);
  const hasMore = ref(true);
  const loadingMore = ref(false);

  const runningPipeline = computed(
    () => pipelines.value.find((p) => p.status === "Running") ?? null,
  );

  async function fetchPipelines(start: string, end: string) {
    loading.value = true;
    error.value = null;
    try {
      const url = `${window.config.API_URL}/pipeline-queue?dateStart=${encodeURIComponent(start)}&dateEnd=${encodeURIComponent(end)}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      pipelines.value = data.data ?? data;
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

  async function fetchInitial() {
    const start = dateRange.value.dateStart || dateStart.value;
    const end = dateRange.value.dateEnd || dateEnd.value;

    let url = `${window.config.API_URL}/pipeline-queue?page=1&limit=100&orderBy=desc`;
    if (start) url += `&dateStart=${encodeURIComponent(start)}`;
    if (end) url += `&dateEnd=${encodeURIComponent(end)}`;

    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data: PipelineQueue[] = json.data ?? json;
    const total: number = json.total ?? data.length;

    pipelines.value = data;
    page.value = 1;
    hasMore.value = total > data.length;
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value) return;

    loadingMore.value = true;
    const nextPage = page.value + 1;
    const start = dateRange.value.dateStart || dateStart.value;
    const end = dateRange.value.dateEnd || dateEnd.value;

    try {
      let url = `${window.config.API_URL}/pipeline-queue?page=${nextPage}&limit=100&orderBy=desc`;
      if (start) url += `&dateStart=${encodeURIComponent(start)}`;
      if (end) url += `&dateEnd=${encodeURIComponent(end)}`;

      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const newData: PipelineQueue[] = json.data ?? json;
      const total: number =
        json.total ?? pipelines.value.length + newData.length;

      // Deduplicate by id before appending
      const existingIds = new Set(pipelines.value.map((p) => p.id));
      const deduped = newData.filter((p) => !existingIds.has(p.id));
      pipelines.value = [...pipelines.value, ...deduped];

      page.value = nextPage;
      hasMore.value = total > pipelines.value.length;
    } finally {
      loadingMore.value = false;
    }
  }

  async function handleSocketUpdated(pipeline: PipelineQueue) {
    const idx = pipelines.value.findIndex((p) => p.id === pipeline.id);
    if (idx !== -1) {
      pipelines.value.splice(idx, 1, { ...pipelines.value[idx], ...pipeline });
    } else {
      pipelines.value = [pipeline, ...pipelines.value];
    }
    if (pipeline.status === "Completed" || pipeline.status === "Failed") {
      const start = dateRange.value.dateStart || dateStart.value;
      const end = dateRange.value.dateEnd || dateEnd.value;
      const self = useDashboardStore();
      try {
        await self.fetchKpis(start, end);
      } catch {
        // silently ignore kpi refresh errors
      }
    }
  }

  function setDateRange(start: string, end: string) {
    dateStart.value = start;
    dateEnd.value = end;
    dateRange.value = { dateStart: start, dateEnd: end };
    fetchPipelines(start, end);
    fetchKpis(start, end);
  }

  async function handleSocketCreated(pipeline: PipelineQueue) {
    // Deduplicate: ignore if id already present
    if (pipelines.value.some((p) => p.id === pipeline.id)) return;

    pipelines.value = [pipeline, ...pipelines.value];
    const start = dateRange.value.dateStart || dateStart.value;
    const end = dateRange.value.dateEnd || dateEnd.value;
    // Use the store instance's fetchKpis so spies can intercept it
    const self = useDashboardStore();
    try {
      await self.fetchKpis(start, end);
    } catch {
      // silently ignore kpi refresh errors (e.g., in test environments)
    }
  }

  return {
    pipelines,
    kpis,
    loading,
    error,
    dateStart,
    dateEnd,
    dateRange,
    page,
    hasMore,
    loadingMore,
    runningPipeline,
    fetchPipelines,
    fetchKpis,
    fetchInitial,
    loadMore,
    handleSocketCreated,
    handleSocketUpdated,
    setDateRange,
  };
});
