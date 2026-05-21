import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "../dashboard.store";

describe("useDashboardStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // @ts-ignore mock compatibility
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makePipeline = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: "p1",
    app: "whiz-server",
    environment: "development",
    commitSha: "abc1234",
    commitMessage: "fix: deps",
    commitAuthor: "Pedro Miranda",
    commitAuthorAvatar: null,
    status: "Queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const mockKpis = { total: 10, succeeded: 7, failed: 2, errorRate: 20.0 };

  it("fetchPipelines(dateStart, dateEnd): calls GET /pipeline-queue?dateStart=&dateEnd=, stores data", async () => {
    // Arrange
    const pipeline = makePipeline();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [pipeline], total: 1, page: 1, limit: 50 }),
    } as Response);

    const store = useDashboardStore();
    const dateStart = "2025-05-01T00:00:00.000Z";
    const dateEnd = "2025-05-08T00:00:00.000Z";

    // Act
    await store.fetchPipelines(dateStart, dateEnd);

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/pipeline-queue"),
      expect.any(Object),
    );
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain(`dateStart=${encodeURIComponent(dateStart)}`);
    expect(url).toContain(`dateEnd=${encodeURIComponent(dateEnd)}`);
    expect(store.pipelines).toEqual([pipeline]);
  });

  it("fetchKpis(dateStart, dateEnd): calls GET /dashboard/kpis?dateStart=&dateEnd=, stores { total, succeeded, failed, errorRate }", async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockKpis,
    } as Response);

    const store = useDashboardStore();
    const dateStart = "2025-05-01T00:00:00.000Z";
    const dateEnd = "2025-05-08T00:00:00.000Z";

    // Act
    await store.fetchKpis(dateStart, dateEnd);

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/dashboard/kpis"),
      expect.any(Object),
    );
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("dateStart=");
    expect(url).toContain("dateEnd=");
    expect(store.kpis).toEqual(mockKpis);
    expect(store.kpis.errorRate).toBe(20.0);
  });

  it("handleSocketCreated(pipeline): prepends pipeline to pipelines array, then calls fetchKpis", async () => {
    // Arrange
    const existingPipeline = makePipeline({
      id: "p-existing",
      status: "Completed",
    });
    const store = useDashboardStore();
    store.$patch({ pipelines: [existingPipeline] });

    // Mock fetchKpis to track calls without real HTTP
    const fetchKpisSpy = vi
      .spyOn(store, "fetchKpis")
      .mockResolvedValue(undefined);

    const newPipeline = makePipeline({ id: "p-new", status: "Queued" });

    // Act
    await store.handleSocketCreated(newPipeline);

    // Assert — new pipeline is prepended (first in array)
    expect(store.pipelines[0]).toEqual(newPipeline);
    expect(store.pipelines[1]).toEqual(existingPipeline);
    expect(fetchKpisSpy).toHaveBeenCalledTimes(1);
  });

  it("handleSocketUpdated(pipeline): finds pipeline by id in array, updates it in-place (no re-fetch)", async () => {
    // Arrange
    const pipeline1 = makePipeline({ id: "p1", status: "Queued" });
    const pipeline2 = makePipeline({
      id: "p2",
      status: "Running",
      app: "other-app",
    });
    const store = useDashboardStore();
    store.$patch({ pipelines: [pipeline1, pipeline2] });

    const fetchPipelinesSpy = vi
      .spyOn(store, "fetchPipelines")
      .mockResolvedValue(undefined);
    const fetchKpisSpy = vi
      .spyOn(store, "fetchKpis")
      .mockResolvedValue(undefined);

    const updatedPipeline = { ...pipeline1, status: "Running" };

    // Act
    store.handleSocketUpdated(updatedPipeline);

    // Assert — pipeline1 updated in-place, pipeline2 unchanged
    expect(store.pipelines[0].status).toBe("Running");
    expect(store.pipelines[1].status).toBe("Running");
    expect(store.pipelines[1].app).toBe("other-app");

    // handleSocketUpdated does NOT call fetchPipelines or fetchKpis
    expect(fetchPipelinesSpy).not.toHaveBeenCalled();
    expect(fetchKpisSpy).not.toHaveBeenCalled();
  });

  it("runningPipeline getter: returns first pipeline with status=Running", () => {
    // Arrange
    const store = useDashboardStore();
    const running = makePipeline({
      id: "p-run",
      status: "Running",
      app: "running-app",
    });
    const queued = makePipeline({
      id: "p-queue",
      status: "Queued",
      app: "queued-app",
    });
    store.$patch({ pipelines: [running, queued] });

    // Assert
    expect(store.runningPipeline).toEqual(running);
    expect(store.runningPipeline?.app).toBe("running-app");
  });

  it("runningPipeline getter: returns null when no pipeline has status=Running", () => {
    // Arrange
    const store = useDashboardStore();
    const p1 = makePipeline({ id: "p1", status: "Completed" });
    const p2 = makePipeline({ id: "p2", status: "Queued" });
    store.$patch({ pipelines: [p1, p2] });

    // Assert
    expect(store.runningPipeline).toBeNull();
  });

  it("runningPipeline getter: returns null when pipelines array is empty", () => {
    // Arrange
    const store = useDashboardStore();
    store.$patch({ pipelines: [] });

    // Assert
    expect(store.runningPipeline).toBeNull();
  });

  // ─── Regression tests (simple-fix: websocket-no-update) ─────────────────────

  it("REG-1: handleSocketUpdated updates pipelines[idx].status reactively after socket event", async () => {
    // Arrange — mount a minimal Vue component that renders pipeline statuses
    // so we can verify DOM reactivity, not just raw store state.
    const { defineComponent, h } = await import("vue");
    const { mount } = await import("@vue/test-utils");

    const store = useDashboardStore();
    const pipeline = makePipeline({ id: "reg-p1", status: "Queued" });
    store.$patch({ pipelines: [pipeline] });

    // A component that renders the status of pipelines[0]
    const TestComponent = defineComponent({
      setup() {
        return () =>
          h(
            "div",
            { "data-test": "status-display" },
            store.pipelines[0]?.status ?? "none",
          );
      },
    });

    const wrapper = mount(TestComponent);
    expect(wrapper.find("[data-test='status-display']").text()).toBe("Queued");

    // Act — simulate socket update via handleSocketUpdated (uses index assignment)
    store.handleSocketUpdated({ ...pipeline, status: "Running" } as any);
    await wrapper.vm.$nextTick();

    // Assert — DOM must reflect the new status after reactivity propagates.
    // FAILS on current code: pipelines.value[idx] = x does not trigger Vue 3
    // dependency tracking for the computed render; splice is required.
    expect(wrapper.find("[data-test='status-display']").text()).toBe("Running");
  });

  it("REG-2: runningPipeline computed returns updated pipeline after handleSocketUpdated sets status to Running", async () => {
    // Arrange — mount a component that renders runningPipeline.id
    const { defineComponent, h } = await import("vue");
    const { mount } = await import("@vue/test-utils");

    const store = useDashboardStore();
    const pipeline = makePipeline({ id: "reg-p2", status: "Queued" });
    store.$patch({ pipelines: [pipeline] });

    const TestComponent = defineComponent({
      setup() {
        return () =>
          h(
            "div",
            { "data-test": "running-id" },
            store.runningPipeline?.id ?? "none",
          );
      },
    });

    const wrapper = mount(TestComponent);
    expect(wrapper.find("[data-test='running-id']").text()).toBe("none");

    // Act — socket event updates status to Running
    store.handleSocketUpdated({ ...pipeline, status: "Running" } as any);
    await wrapper.vm.$nextTick();

    // Assert — the rendered running id must now reflect reg-p2.
    // FAILS on current code: index assignment does not invalidate the computed
    // dependency chain; splice is required.
    expect(wrapper.find("[data-test='running-id']").text()).toBe("reg-p2");
  });

  it("REG-5: handleSocketUpdated with unknown id leaves pipelines unchanged and throws no exception", () => {
    // Arrange
    const store = useDashboardStore();
    const pipeline = makePipeline({ id: "known-id", status: "Queued" });
    store.$patch({ pipelines: [pipeline] });

    // Act — pass a pipeline whose id does not exist in the array
    const unknownPipeline = makePipeline({ id: "ghost-id", status: "Running" });
    expect(() =>
      store.handleSocketUpdated(unknownPipeline as any),
    ).not.toThrow();

    // Assert — original array is intact
    expect(store.pipelines).toHaveLength(1);
    expect(store.pipelines[0].id).toBe("known-id");
    expect(store.pipelines[0].status).toBe("Queued");
  });
});
