import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "../dashboard.store";

// Mock apiFetch so tests never hit the network.
// The actual module uses `apiFetch` (named export) imported in dashboard.store.ts.
vi.mock("../../lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../../lib/apiFetch";

const mockedApiFetch = vi.mocked(apiFetch);

const DEFAULT_API_RESPONSE = {
  data: [],
  total: 0,
  page: 1,
  limit: 10,
};

function makeApiResponse(overrides: Partial<typeof DEFAULT_API_RESPONSE> = {}) {
  const payload = { ...DEFAULT_API_RESPONSE, ...overrides };
  return {
    ok: true,
    json: async () => payload,
  } as unknown as Response;
}

const makePipeline = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "p1",
  app: "whiz-server",
  environment: "development" as const,
  commitSha: "abc1234",
  commitMessage: "fix: deps",
  commitAuthor: "Pedro Miranda",
  commitAuthorAvatar: null,
  status: "Queued" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("dashboard.store — pagination (AC-1 a AC-7)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
    mockedApiFetch.mockResolvedValue(makeApiResponse());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-1: estado inicial — page=1, limit=10, total=0", () => {
    const store = useDashboardStore();

    expect(store.page).toBe(1);
    expect(store.limit).toBe(10);
    expect(store.total).toBe(0);
  });

  it("AC-2: fetchPipelines atribui pipelines=res.data e total=res.total quando API retorna { data, total, page, limit }", async () => {
    const pipeline = makePipeline({ id: "p-ac2" });
    mockedApiFetch.mockResolvedValueOnce(
      makeApiResponse({ data: [pipeline], total: 7, page: 1, limit: 10 }),
    );

    const store = useDashboardStore();
    await store.fetchPipelines("2025-01-01T00:00:00.000Z", "2025-01-08T00:00:00.000Z");

    expect(store.pipelines).toEqual([pipeline]);
    expect(store.total).toBe(7);
  });

  it("AC-3: fetchPipelines inclui page e limit como query params na URL", async () => {
    const store = useDashboardStore();
    store.$patch({ page: 2, limit: 10 } as any);

    await store.fetchPipelines("2025-01-01T00:00:00.000Z", "2025-01-08T00:00:00.000Z");

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockedApiFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("limit=10");
  });

  it("AC-4: setPage(3) atualiza page=3 e invoca fetchPipelines", async () => {
    const store = useDashboardStore();
    store.$patch({ page: 2, dateStart: "2025-01-01T00:00:00.000Z", dateEnd: "2025-01-08T00:00:00.000Z" } as any);

    const fetchSpy = vi.spyOn(store, "fetchPipelines").mockResolvedValue(undefined);

    await store.setPage(3);

    expect(store.page).toBe(3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("AC-5: setLimit(100) atualiza limit=100, reseta page=1 e invoca fetchPipelines", async () => {
    const store = useDashboardStore();
    store.$patch({ limit: 10, page: 3, dateStart: "2025-01-01T00:00:00.000Z", dateEnd: "2025-01-08T00:00:00.000Z" } as any);

    const fetchSpy = vi.spyOn(store, "fetchPipelines").mockResolvedValue(undefined);

    await store.setLimit(100);

    expect(store.limit).toBe(100);
    expect(store.page).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("AC-6: setDateRange com page=2 reseta page=1 antes do fetch", async () => {
    const store = useDashboardStore();
    store.$patch({ page: 2 } as any);

    // Allow fetchKpis to resolve silently
    mockedApiFetch.mockResolvedValue(makeApiResponse());

    await store.setDateRange("2025-02-01T00:00:00.000Z", "2025-02-08T00:00:00.000Z");

    expect(store.page).toBe(1);
  });

  it("AC-7: handleSocketCreated seta page=1 e invoca fetchPipelines (sem prepend manual)", async () => {
    const store = useDashboardStore();
    store.$patch({ page: 3, dateStart: "2025-01-01T00:00:00.000Z", dateEnd: "2025-01-08T00:00:00.000Z" } as any);

    const existingPipeline = makePipeline({ id: "existing", status: "Completed" });
    store.$patch({ pipelines: [existingPipeline] } as any);

    const fetchSpy = vi.spyOn(store, "fetchPipelines").mockResolvedValue(undefined);

    const newPipeline = makePipeline({ id: "p-new", status: "Queued" });
    await store.handleSocketCreated(newPipeline);

    expect(store.page).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // The new pipeline must NOT have been prepended — store.pipelines still equals the original array
    // (fetchPipelines is the source of truth now, not manual prepend)
    const hasPrepended = store.pipelines[0]?.id === "p-new" && store.pipelines.length === 2;
    expect(hasPrepended).toBe(false);
  });
});
