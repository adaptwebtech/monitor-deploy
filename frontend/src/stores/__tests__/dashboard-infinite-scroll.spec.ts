import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "../dashboard.store";

describe("useDashboardStore — infinite scroll (AC-6, AC-7, AC-8, AC-9, AC-10, AC-15)", () => {
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

  function mockFetchResponse(data: unknown[], total: number, page = 1) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data, total, page, limit: 100 }),
    } as Response);
  }

  // ─── AC-6 ────────────────────────────────────────────────────────────────────

  it("AC-6: fetchInitial() calls GET /pipeline-queue with page=1 and limit=100", async () => {
    const pipeline = makePipeline({ id: "p1" });
    mockFetchResponse([pipeline], 1);

    const store = useDashboardStore();
    await store.fetchInitial();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/pipeline-queue/),
      expect.any(Object),
    );
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("page=1");
    expect(url).toContain("limit=100");
  });

  it("AC-6: fetchInitial() stores returned items in pipelines", async () => {
    const pipeline = makePipeline({ id: "p1" });
    mockFetchResponse([pipeline], 1);

    const store = useDashboardStore();
    await store.fetchInitial();

    expect(store.pipelines).toHaveLength(1);
    expect(store.pipelines[0].id).toBe("p1");
  });

  // ─── AC-7 ────────────────────────────────────────────────────────────────────

  it("AC-7: loadMore() appends next batch without replacing existing items", async () => {
    const batch1 = [makePipeline({ id: "p1" }), makePipeline({ id: "p2" })];
    mockFetchResponse(batch1, 4);

    const store = useDashboardStore();
    await store.fetchInitial();
    expect(store.pipelines).toHaveLength(2);
    expect(store.hasMore).toBe(true);

    const batch2 = [makePipeline({ id: "p3" }), makePipeline({ id: "p4" })];
    mockFetchResponse(batch2, 4);

    await store.loadMore();

    expect(store.pipelines).toHaveLength(4);
    expect(store.pipelines[0].id).toBe("p1");
    expect(store.pipelines[1].id).toBe("p2");
    expect(store.pipelines[2].id).toBe("p3");
    expect(store.pipelines[3].id).toBe("p4");
  });

  it("AC-7: loadMore() increments page for next API request", async () => {
    const batch1 = Array.from({ length: 2 }, (_, i) =>
      makePipeline({ id: `p${i}` }),
    );
    mockFetchResponse(batch1, 4);
    const store = useDashboardStore();
    await store.fetchInitial();

    mockFetchResponse([], 4);
    await store.loadMore();

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const loadMoreUrl = calls[1][0] as string;
    expect(loadMoreUrl).toContain("page=2");
  });

  it("AC-7: loadMore() is a no-op when hasMore is false", async () => {
    const batch1 = [makePipeline({ id: "p1" })];
    mockFetchResponse(batch1, 1);

    const store = useDashboardStore();
    await store.fetchInitial();
    expect(store.hasMore).toBe(false);

    const callCountBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls
      .length;
    await store.loadMore();
    const callCountAfter = (fetch as ReturnType<typeof vi.fn>).mock.calls
      .length;

    expect(callCountAfter).toBe(callCountBefore);
  });

  it("AC-7: loadMore() is a no-op when loadingMore is true (guard against concurrent calls)", async () => {
    const batch1 = Array.from({ length: 2 }, (_, i) =>
      makePipeline({ id: `p${i}` }),
    );
    mockFetchResponse(batch1, 4);
    const store = useDashboardStore();
    await store.fetchInitial();

    // Patch loadingMore to simulate concurrent call in flight
    store.$patch({ loadingMore: true });

    const callCountBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls
      .length;
    await store.loadMore();
    const callCountAfter = (fetch as ReturnType<typeof vi.fn>).mock.calls
      .length;

    expect(callCountAfter).toBe(callCountBefore);
  });

  // ─── AC-8 ────────────────────────────────────────────────────────────────────

  it("AC-8: handleSocketCreated() prepends new item at top of pipelines without resetting pagination", async () => {
    const existing = makePipeline({ id: "existing-1" });
    mockFetchResponse([existing], 5);

    const store = useDashboardStore();
    await store.fetchInitial();
    const pageAfterInitial = store.page;
    expect(pageAfterInitial).toBe(1);

    const newPipeline = makePipeline({ id: "new-ws" });
    store.handleSocketCreated(newPipeline as any);

    expect(store.pipelines[0].id).toBe("new-ws");
    expect(store.pipelines[1].id).toBe("existing-1");
    expect(store.page).toBe(pageAfterInitial);
  });

  it("AC-8: handleSocketCreated() ignores item if id already exists (deduplication)", async () => {
    const existing = makePipeline({ id: "dup-1", status: "Queued" });
    mockFetchResponse([existing], 1);

    const store = useDashboardStore();
    await store.fetchInitial();
    expect(store.pipelines).toHaveLength(1);

    // Same id arrives via WS — should be ignored
    const duplicate = makePipeline({ id: "dup-1", status: "Running" });
    store.handleSocketCreated(duplicate as any);

    expect(store.pipelines).toHaveLength(1);
    // Original must remain, not the duplicate
    expect(store.pipelines[0].status).toBe("Queued");
  });

  // ─── AC-9 ────────────────────────────────────────────────────────────────────

  it("AC-9: handleSocketUpdated() updates matching item in-place without reordering", async () => {
    const p1 = makePipeline({ id: "p1", status: "Queued" });
    const p2 = makePipeline({ id: "p2", status: "Running" });
    const store = useDashboardStore();
    store.$patch({ pipelines: [p1, p2] });

    store.handleSocketUpdated({ ...p1, status: "Completed" } as any);

    expect(store.pipelines[0].id).toBe("p1");
    expect(store.pipelines[0].status).toBe("Completed");
    expect(store.pipelines[1].id).toBe("p2");
    expect(store.pipelines[1].status).toBe("Running");
  });

  it("AC-9: handleSocketUpdated() does not add new item if id not found", async () => {
    const p1 = makePipeline({ id: "p1" });
    const store = useDashboardStore();
    store.$patch({ pipelines: [p1] });

    store.handleSocketUpdated({
      ...p1,
      id: "ghost",
      status: "Completed",
    } as any);

    expect(store.pipelines).toHaveLength(1);
    expect(store.pipelines[0].id).toBe("p1");
  });

  // ─── AC-10 ───────────────────────────────────────────────────────────────────

  it("AC-10: hasMore=false when total <= pipelines.length after fetchInitial", async () => {
    const items = [makePipeline({ id: "p1" }), makePipeline({ id: "p2" })];
    mockFetchResponse(items, 2);

    const store = useDashboardStore();
    await store.fetchInitial();

    expect(store.hasMore).toBe(false);
  });

  it("AC-10: hasMore=true when total > pipelines.length after fetchInitial", async () => {
    const items = [makePipeline({ id: "p1" })];
    mockFetchResponse(items, 100);

    const store = useDashboardStore();
    await store.fetchInitial();

    expect(store.hasMore).toBe(true);
  });

  it("AC-10: hasMore becomes false once all items are loaded via loadMore", async () => {
    const batch1 = [makePipeline({ id: "p1" }), makePipeline({ id: "p2" })];
    mockFetchResponse(batch1, 3);

    const store = useDashboardStore();
    await store.fetchInitial();
    expect(store.hasMore).toBe(true);

    const batch2 = [makePipeline({ id: "p3" })];
    mockFetchResponse(batch2, 3);
    await store.loadMore();

    expect(store.hasMore).toBe(false);
  });

  it("AC-10: loadMore is not triggered again when hasMore=false", async () => {
    const items = [makePipeline({ id: "p1" })];
    mockFetchResponse(items, 1);

    const store = useDashboardStore();
    await store.fetchInitial();
    expect(store.hasMore).toBe(false);

    const callsBefore = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await store.loadMore();
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callsBefore,
    );
  });

  // ─── AC-15 ───────────────────────────────────────────────────────────────────

  it("AC-15: changing dateRange resets pipelines and calls fetchInitial from page=1", async () => {
    // Load first page
    const batch1 = Array.from({ length: 3 }, (_, i) =>
      makePipeline({ id: `old-${i}` }),
    );
    mockFetchResponse(batch1, 10);
    const store = useDashboardStore();
    await store.fetchInitial();
    expect(store.pipelines).toHaveLength(3);

    // Now simulate loadMore so page > 1
    const batch2 = Array.from({ length: 3 }, (_, i) =>
      makePipeline({ id: `old-more-${i}` }),
    );
    mockFetchResponse(batch2, 10);
    await store.loadMore();
    expect(store.pipelines).toHaveLength(6);
    expect(store.page).toBeGreaterThan(1);

    // Now change dateRange — should reset and call fetchInitial
    const freshBatch = [makePipeline({ id: "fresh-1" })];
    mockFetchResponse(freshBatch, 1);

    store.$patch({
      dateRange: {
        dateStart: "2026-01-01T00:00:00.000Z",
        dateEnd: "2026-01-31T00:00:00.000Z",
      },
    });
    await store.fetchInitial();

    expect(store.pipelines).toHaveLength(1);
    expect(store.pipelines[0].id).toBe("fresh-1");
    expect(store.page).toBe(1);

    // The last fetch call must include page=1
    const allCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const lastUrl = allCalls[allCalls.length - 1][0] as string;
    expect(lastUrl).toContain("page=1");
  });

  it("AC-15: fetchInitial() resets pipelines array to new data (does not append to existing)", async () => {
    const initialBatch = [makePipeline({ id: "init-1" })];
    mockFetchResponse(initialBatch, 1);
    const store = useDashboardStore();
    await store.fetchInitial();
    expect(store.pipelines).toHaveLength(1);

    const newBatch = [
      makePipeline({ id: "reset-1" }),
      makePipeline({ id: "reset-2" }),
    ];
    mockFetchResponse(newBatch, 2);
    await store.fetchInitial();

    expect(store.pipelines).toHaveLength(2);
    expect(store.pipelines[0].id).toBe("reset-1");
  });
});
