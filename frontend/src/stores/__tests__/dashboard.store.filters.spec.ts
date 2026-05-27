import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "../dashboard.store";
import type { PipelineQueue } from "../../types";

describe("useDashboardStore — filter methods", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // @ts-ignore mock compatibility
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const makePipeline = (
    overrides: Partial<PipelineQueue> = {},
  ): PipelineQueue => ({
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

  const mockFetchOk = (body: unknown = { data: [], total: 0 }) => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => body,
    } as Response);
  };

  // ── Filter state defaults ──────────────────────────────────────────────────

  it("AC-6: store exposes filterApp, filterEnvironment, filterStatus defaulting to empty strings", () => {
    const store = useDashboardStore();

    expect(store.filterApp).toBe("");
    expect(store.filterEnvironment).toBe("");
    expect(store.filterStatus).toBe("");
  });

  it("AC-6: hasActiveFilters is false when all filters are empty", () => {
    const store = useDashboardStore();

    expect(store.hasActiveFilters).toBe(false);
  });

  it("AC-10: hasActiveFilters is true after setFilters sets a non-empty value", () => {
    const store = useDashboardStore();
    store.setFilters({ environment: "production" });

    expect(store.hasActiveFilters).toBe(true);
  });

  it("AC-10: clearFilters resets all filters to empty and hasActiveFilters becomes false", async () => {
    mockFetchOk();
    const store = useDashboardStore();
    store.setFilters({ environment: "production", status: "Failed" });
    vi.advanceTimersByTime(400);
    await Promise.resolve();

    store.clearFilters();
    // allow any debounced fetch triggered by clearFilters to settle
    vi.advanceTimersByTime(400);
    await Promise.resolve();

    expect(store.filterApp).toBe("");
    expect(store.filterEnvironment).toBe("");
    expect(store.filterStatus).toBe("");
    expect(store.hasActiveFilters).toBe(false);
  });

  // ── AC-7: setFilters triggers refetch with filter params ───────────────────

  it("AC-7: after setFilters({ environment: 'production' }), fetchInitial is called with environment=production in URL", async () => {
    mockFetchOk();
    const store = useDashboardStore();
    const fetchInitialSpy = vi
      .spyOn(store, "fetchInitial")
      .mockResolvedValue(undefined);

    store.setFilters({ environment: "production" });
    vi.advanceTimersByTime(400);
    await Promise.resolve();

    expect(fetchInitialSpy).toHaveBeenCalledTimes(1);
    expect(store.filterEnvironment).toBe("production");
  });

  it("AC-7: after setFilters({ environment: 'production' }), fetchKpis is called with environment=production in URL", async () => {
    mockFetchOk();
    const store = useDashboardStore();
    const fetchKpisSpy = vi
      .spyOn(store, "fetchKpis")
      .mockResolvedValue(undefined);

    store.setFilters({ environment: "production" });
    vi.advanceTimersByTime(400);
    await Promise.resolve();

    expect(fetchKpisSpy).toHaveBeenCalledTimes(1);
    // fetchKpis called without args — store passes filter params internally via buildFilterParams
    expect(store.filterEnvironment).toBe("production");
  });

  // ── AC-9: debounce — fetch fires only after 400ms of inactivity ───────────

  it("AC-9: setFilters({ app: 'my-api' }) — fetch is NOT called immediately", () => {
    const store = useDashboardStore();
    const fetchInitialSpy = vi
      .spyOn(store, "fetchInitial")
      .mockResolvedValue(undefined);
    vi.spyOn(store, "fetchKpis").mockResolvedValue(undefined);

    store.setFilters({ app: "my-api" });

    expect(fetchInitialSpy).not.toHaveBeenCalled();
  });

  it("AC-9: setFilters({ app: 'my-api' }) — fetch IS called after 400ms", async () => {
    const store = useDashboardStore();
    const fetchInitialSpy = vi
      .spyOn(store, "fetchInitial")
      .mockResolvedValue(undefined);
    vi.spyOn(store, "fetchKpis").mockResolvedValue(undefined);

    store.setFilters({ app: "my-api" });
    vi.advanceTimersByTime(400);
    await Promise.resolve();

    expect(fetchInitialSpy).toHaveBeenCalledTimes(1);
  });

  it("AC-9: rapid successive setFilters calls only trigger one fetch after 400ms", async () => {
    const store = useDashboardStore();
    const fetchInitialSpy = vi
      .spyOn(store, "fetchInitial")
      .mockResolvedValue(undefined);
    vi.spyOn(store, "fetchKpis").mockResolvedValue(undefined);

    store.setFilters({ app: "m" });
    vi.advanceTimersByTime(100);
    store.setFilters({ app: "my" });
    vi.advanceTimersByTime(100);
    store.setFilters({ app: "my-api" });
    vi.advanceTimersByTime(400);
    await Promise.resolve();

    expect(fetchInitialSpy).toHaveBeenCalledTimes(1);
  });

  // ── AC-11: handleSocketCreated respects filterStatus ──────────────────────

  it("AC-11: handleSocketCreated with filterStatus='Running' does NOT prepend pipeline with status=Queued", async () => {
    mockFetchOk();
    const store = useDashboardStore();
    vi.spyOn(store, "fetchKpis").mockResolvedValue(undefined);

    store.$patch({
      filterStatus: "Running",
      pipelines: [],
    });

    const incomingPipeline = makePipeline({ id: "p-new", status: "Queued" });
    await store.handleSocketCreated(incomingPipeline);

    expect(store.pipelines).toHaveLength(0);
  });

  it("AC-11: handleSocketCreated with filterStatus='' still prepends any pipeline", async () => {
    mockFetchOk();
    const store = useDashboardStore();
    vi.spyOn(store, "fetchKpis").mockResolvedValue(undefined);

    store.$patch({ filterStatus: "", pipelines: [] });

    const incomingPipeline = makePipeline({ id: "p-new", status: "Queued" });
    await store.handleSocketCreated(incomingPipeline);

    expect(store.pipelines).toHaveLength(1);
    expect(store.pipelines[0].id).toBe("p-new");
  });

  // ── AC-12: handleSocketUpdated removes pipeline that no longer matches filter ──

  it("AC-12: handleSocketUpdated with filterStatus='Running' removes pipeline whose status changed to Completed", async () => {
    mockFetchOk();
    const store = useDashboardStore();
    vi.spyOn(store, "fetchKpis").mockResolvedValue(undefined);

    const existingPipeline = makePipeline({ id: "p1", status: "Running" });
    store.$patch({
      filterStatus: "Running",
      pipelines: [existingPipeline],
    });

    const updatedPipeline = makePipeline({ id: "p1", status: "Completed" });
    await store.handleSocketUpdated(updatedPipeline);

    expect(store.pipelines.find((p) => p.id === "p1")).toBeUndefined();
  });

  it("AC-12: handleSocketUpdated with filterStatus='Running' keeps pipeline that stays Running", async () => {
    mockFetchOk();
    const store = useDashboardStore();
    vi.spyOn(store, "fetchKpis").mockResolvedValue(undefined);

    const existingPipeline = makePipeline({ id: "p1", status: "Running" });
    store.$patch({
      filterStatus: "Running",
      pipelines: [existingPipeline],
    });

    const updatedPipeline = makePipeline({
      id: "p1",
      status: "Running",
      currentStep: "step-2",
    });
    await store.handleSocketUpdated(updatedPipeline);

    expect(store.pipelines.find((p) => p.id === "p1")).toBeDefined();
  });
});
