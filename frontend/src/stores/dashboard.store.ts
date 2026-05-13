import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { PipelineQueue, KpiStats } from "../types";

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

  const runningPipeline = computed(
    () => pipelines.value.find((p) => p.status === "Running") ?? null,
  );

  async function fetchPipelines(start: string, end: string) {
    loading.value = true;
    error.value = null;
    try {
      const token = localStorage.getItem("accessToken");
      const url = `${window.config.API_URL}/pipeline-queue?dateStart=${encodeURIComponent(start)}&dateEnd=${encodeURIComponent(end)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    const token = localStorage.getItem("accessToken");
    const url = `${window.config.API_URL}/dashboard/kpis?dateStart=${encodeURIComponent(start)}&dateEnd=${encodeURIComponent(end)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    kpis.value = await res.json();
  }

  function handleSocketUpdated(pipeline: PipelineQueue) {
    const idx = pipelines.value.findIndex((p) => p.id === pipeline.id);
    if (idx !== -1) {
      pipelines.value[idx] = { ...pipelines.value[idx], ...pipeline };
    }
  }

  function setDateRange(start: string, end: string) {
    dateStart.value = start;
    dateEnd.value = end;
    fetchPipelines(start, end);
    fetchKpis(start, end);
  }

  // handleSocketCreated is defined after, so it can reference the store
  // We use a deferred approach via the store's own fetchKpis method reference

  async function handleSocketCreated(pipeline: PipelineQueue) {
    pipelines.value = [pipeline, ...pipelines.value];
    const start = dateStart.value;
    const end = dateEnd.value;
    // Use the store instance's fetchKpis so spies can intercept it
    const self = useDashboardStore();
    await self.fetchKpis(start, end);
  }

  return {
    pipelines,
    kpis,
    loading,
    error,
    dateStart,
    dateEnd,
    runningPipeline,
    fetchPipelines,
    fetchKpis,
    handleSocketCreated,
    handleSocketUpdated,
    setDateRange,
  };
});
