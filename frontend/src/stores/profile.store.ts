import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { PipelineQueue } from "../types";
import { apiFetch } from "../lib/apiFetch";

export const useProfileStore = defineStore("profile", () => {
  const history = ref<PipelineQueue[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const page = ref(1);
  const limit = ref<10 | 100>(10);
  const total = ref(0);
  const orderBy = ref<"desc" | "asc">("desc");

  const totalPages = computed(() => Math.ceil(total.value / limit.value));

  async function fetchHistory() {
    loading.value = true;
    error.value = null;
    try {
      const url = `${window.config.API_URL}/pipeline-queue/mine?page=${page.value}&limit=${limit.value}&orderBy=${orderBy.value}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      history.value = json.data ?? json;
      total.value = json.total ?? history.value.length;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Error";
    } finally {
      loading.value = false;
    }
  }

  async function changePage(n: number) {
    page.value = n;
    await fetchHistory();
  }

  async function changeLimit(n: 10 | 100) {
    limit.value = n;
    page.value = 1;
    await fetchHistory();
  }

  async function changeOrder(o: "desc" | "asc") {
    orderBy.value = o;
    page.value = 1;
    await fetchHistory();
  }

  return {
    history,
    loading,
    error,
    page,
    limit,
    total,
    orderBy,
    totalPages,
    fetchHistory,
    changePage,
    changeLimit,
    changeOrder,
  };
});
