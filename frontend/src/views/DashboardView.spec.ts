import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { useDashboardStore } from "../stores/dashboard.store";

// Mock apiFetch so onMounted network calls don't escape.
vi.mock("../lib/apiFetch", () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], total: 0, page: 1, limit: 10 }),
  }),
}));

// Stub heavy child components so the view mounts without full dependency trees.
vi.mock("../composables/usePipelineSocket", () => ({
  usePipelineSocket: vi.fn(() => ({
    onCreated: vi.fn(),
    onUpdated: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

import DashboardView from "./DashboardView.vue";

function mountView() {
  return mount(DashboardView, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            dashboard: {
              pipelines: [],
              kpis: { total: 0, succeeded: 0, failed: 0, errorRate: 0 },
              loading: false,
              error: null,
              dateStart: "2025-01-01T00:00:00.000Z",
              dateEnd: "2025-01-08T00:00:00.000Z",
              page: 1,
              limit: 10,
              total: 0,
            },
          },
        }),
      ],
      stubs: {
        AppLayout: { template: "<div><slot /></div>" },
        DateRangeFilter: true,
        RunningIndicator: true,
        KpiCards: true,
        // PipelineTable must NOT be stubbed — we need to interact with its emits
        StatusBadge: true,
        AvatarCell: true,
      },
    },
  });
}

describe("DashboardView — integração com paginação (AC-15 a AC-16)", () => {
  beforeEach(() => {
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-15: quando PipelineTable emite update:page com valor 3, dashboardStore.setPage é chamado com 3", async () => {
    const wrapper = mountView();
    const store = useDashboardStore();

    const setPageSpy = vi.spyOn(store, "setPage").mockResolvedValue(undefined);

    // Find the PipelineTable component instance and trigger the emit
    const pipelineTable = wrapper.findComponent({ name: "PipelineTable" });
    expect(pipelineTable.exists()).toBe(true);

    await pipelineTable.vm.$emit("update:page", 3);

    expect(setPageSpy).toHaveBeenCalledTimes(1);
    expect(setPageSpy).toHaveBeenCalledWith(3);
  });

  it("AC-16: quando PipelineTable emite update:limit com valor 100, dashboardStore.setLimit é chamado com 100", async () => {
    const wrapper = mountView();
    const store = useDashboardStore();

    const setLimitSpy = vi.spyOn(store, "setLimit").mockResolvedValue(undefined);

    const pipelineTable = wrapper.findComponent({ name: "PipelineTable" });
    expect(pipelineTable.exists()).toBe(true);

    await pipelineTable.vm.$emit("update:limit", 100);

    expect(setLimitSpy).toHaveBeenCalledTimes(1);
    expect(setLimitSpy).toHaveBeenCalledWith(100);
  });
});
