<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import { useDashboardStore } from "../stores/dashboard.store";
import { useAuthStore } from "../stores/auth.store";
import { usePipelineSocket } from "../composables/usePipelineSocket";

// Child components — imported for non-stubbed usage
import DateRangeFilter from "../components/DateRangeFilter.vue";
import RunningIndicator from "../components/RunningIndicator.vue";
import KpiCards from "../components/KpiCards.vue";
import PipelineTable from "../components/PipelineTable.vue";

const dashboardStore = useDashboardStore();
const authStore = useAuthStore();

// Default date range: last 7 days
const now = new Date();
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const dateStart = sevenDaysAgo.toISOString();
const dateEnd = now.toISOString();

let socketConnection: ReturnType<typeof usePipelineSocket> | null = null;

onMounted(async () => {
  dashboardStore.$patch({ dateStart, dateEnd });
  await dashboardStore.fetchPipelines(dateStart, dateEnd);
  await dashboardStore.fetchKpis(dateStart, dateEnd);

  // Connect WebSocket
  if (authStore.accessToken) {
    socketConnection = usePipelineSocket(authStore.accessToken);
    socketConnection.onCreated((pipeline) => {
      dashboardStore.handleSocketCreated(pipeline);
    });
    socketConnection.onUpdated((pipeline) => {
      dashboardStore.handleSocketUpdated(pipeline);
    });
  }
});

onUnmounted(() => {
  socketConnection?.disconnect();
});
</script>

<template>
  <AppLayout>
    <div class="container-fluid py-4">
      <!-- Top bar: date filter + running indicator -->
      <div
        class="d-flex flex-column flex-md-row justify-content-between align-items-start mb-4 gap-3"
      >
        <DateRangeFilter />
        <RunningIndicator :running="dashboardStore.runningPipeline" />
      </div>

      <!-- KPI Cards -->
      <KpiCards :stats="dashboardStore.kpis" />

      <!-- Pipeline Table -->
      <div class="mt-4">
        <PipelineTable :pipelines="dashboardStore.pipelines" />
      </div>
    </div>
  </AppLayout>
</template>
