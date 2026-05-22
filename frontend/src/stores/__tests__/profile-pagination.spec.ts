import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useProfileStore } from "../profile.store";

describe("useProfileStore — pagination (AC-11, AC-12, AC-13)", () => {
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
    commitMessage: "fix: test",
    commitAuthor: "Pedro Miranda",
    commitAuthorAvatar: null,
    status: "Completed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  function mockFetchResponse(
    data: unknown[],
    total: number,
    page = 1,
    limit = 10,
  ) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data, total, page, limit }),
    } as Response);
  }

  // ─── AC-11 ───────────────────────────────────────────────────────────────────

  it("AC-11: fetchHistory() calls GET /pipeline-queue/mine with page=1, limit=10, orderBy=desc", async () => {
    const items = [makePipeline({ id: "h1" })];
    mockFetchResponse(items, 1, 1, 10);

    const store = useProfileStore();
    await store.fetchHistory();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/pipeline-queue\/mine/),
      expect.any(Object),
    );
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("page=1");
    expect(url).toContain("limit=10");
    expect(url).toContain("orderBy=desc");
  });

  it("AC-11: fetchHistory() stores returned items in history", async () => {
    const items = [makePipeline({ id: "h1" }), makePipeline({ id: "h2" })];
    mockFetchResponse(items, 2);

    const store = useProfileStore();
    await store.fetchHistory();

    expect(store.history).toHaveLength(2);
    expect(store.history[0].id).toBe("h1");
    expect(store.history[1].id).toBe("h2");
  });

  it("AC-11: fetchHistory() stores total from API response", async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makePipeline({ id: `h${i}` }),
    );
    mockFetchResponse(items, 87);

    const store = useProfileStore();
    await store.fetchHistory();

    expect(store.total).toBe(87);
  });

  // ─── AC-12 ───────────────────────────────────────────────────────────────────

  it("AC-12: changePage(2) sets page to 2 and calls fetchHistory", async () => {
    // Initial load
    mockFetchResponse([], 87, 1, 10);
    const store = useProfileStore();
    await store.fetchHistory();

    // Page 2
    mockFetchResponse([], 87, 2, 10);
    await store.changePage(2);

    expect(store.page).toBe(2);
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const page2Url = calls[1][0] as string;
    expect(page2Url).toContain("page=2");
  });

  it("AC-12: changePage(2) re-queries API with correct page number", async () => {
    mockFetchResponse([], 87, 1, 10);
    const store = useProfileStore();
    await store.fetchHistory();

    const batch2 = Array.from({ length: 10 }, (_, i) =>
      makePipeline({ id: `page2-${i}` }),
    );
    mockFetchResponse(batch2, 87, 2, 10);
    await store.changePage(2);

    expect(store.history).toHaveLength(10);
    expect(store.history[0].id).toBe("page2-0");
  });

  it("AC-12: changePage() updates table data (history is replaced, not appended)", async () => {
    const page1Items = [makePipeline({ id: "p1-item" })];
    mockFetchResponse(page1Items, 20, 1, 10);
    const store = useProfileStore();
    await store.fetchHistory();
    expect(store.history[0].id).toBe("p1-item");

    const page2Items = [makePipeline({ id: "p2-item" })];
    mockFetchResponse(page2Items, 20, 2, 10);
    await store.changePage(2);

    expect(store.history).toHaveLength(1);
    expect(store.history[0].id).toBe("p2-item");
  });

  // ─── AC-13 ───────────────────────────────────────────────────────────────────

  it("AC-13: changeLimit(100) calls changeLimit with 100 and resets page to 1", async () => {
    // Start on page 2
    mockFetchResponse([], 87, 1, 10);
    const store = useProfileStore();
    await store.fetchHistory();

    mockFetchResponse([], 87, 2, 10);
    await store.changePage(2);
    expect(store.page).toBe(2);

    // Now change limit
    mockFetchResponse([], 87, 1, 100);
    await store.changeLimit(100);

    expect(store.page).toBe(1);
    expect(store.limit).toBe(100);
  });

  it("AC-13: changeLimit(100) re-queries API with limit=100 and page=1", async () => {
    mockFetchResponse([], 87, 1, 10);
    const store = useProfileStore();
    await store.fetchHistory();

    mockFetchResponse([], 87, 1, 100);
    await store.changeLimit(100);

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const limitChangeUrl = calls[calls.length - 1][0] as string;
    expect(limitChangeUrl).toContain("limit=100");
    expect(limitChangeUrl).toContain("page=1");
  });

  it("AC-13: changeLimit() updates history with data returned for new limit", async () => {
    mockFetchResponse([], 87, 1, 10);
    const store = useProfileStore();
    await store.fetchHistory();

    const largeItems = Array.from({ length: 87 }, (_, i) =>
      makePipeline({ id: `big-${i}` }),
    );
    mockFetchResponse(largeItems, 87, 1, 100);
    await store.changeLimit(100);

    expect(store.history).toHaveLength(87);
  });

  // ─── changeOrder (bonus — spec §FR-8, AC-11 orderBy param) ──────────────────

  it("AC-11 (changeOrder): changeOrder('asc') re-queries with orderBy=asc", async () => {
    mockFetchResponse([], 10, 1, 10);
    const store = useProfileStore();
    await store.fetchHistory();

    mockFetchResponse([], 10, 1, 10);
    await store.changeOrder("asc");

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    const orderUrl = calls[calls.length - 1][0] as string;
    expect(orderUrl).toContain("orderBy=asc");
    expect(store.orderBy).toBe("asc");
  });
});
