import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "../dashboard.store";

vi.mock("../../lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

describe("dashboard.store — regression tests (ws-completion)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // @ts-ignore mock compatibility
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
    vi.clearAllMocks();
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
    status: "Running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it("REG-2: handleSocketUpdated with status 'Completed' calls fetchKpis with current date range args", async () => {
    // Arrange
    const store = useDashboardStore();
    const dateStart = "2026-05-15T00:00:00.000Z";
    const dateEnd = "2026-05-22T23:59:59.000Z";

    store.$patch({
      dateStart,
      dateEnd,
      dateRange: { dateStart, dateEnd },
      pipelines: [makePipeline({ id: "p1", status: "Running" })],
    });

    // Spy on fetchKpis — current code never calls it from handleSocketUpdated → RED
    const fetchKpisSpy = vi
      .spyOn(store, "fetchKpis")
      .mockResolvedValue(undefined);

    const completedPipeline = makePipeline({ id: "p1", status: "Completed" });

    // Act
    store.handleSocketUpdated(completedPipeline as any);

    // Wait a tick in case implementation uses async
    await Promise.resolve();

    // Assert — fetchKpis must have been called with the stored date range
    expect(fetchKpisSpy).toHaveBeenCalledTimes(1);
    expect(fetchKpisSpy).toHaveBeenCalledWith(dateStart, dateEnd);
  });

  it("REG-4: handleSocketUpdated with idx === -1 (pipeline not in array) inserts pipeline at index 0", () => {
    // Arrange
    const store = useDashboardStore();
    const existing = makePipeline({ id: "existing-id", status: "Completed" });
    store.$patch({ pipelines: [existing] });

    const newPipeline = makePipeline({ id: "ghost-id", status: "Running" });

    // Act — pipeline not in list (idx === -1); current code silently drops it → RED
    store.handleSocketUpdated(newPipeline as any);

    // Assert — new pipeline must be inserted at index 0
    expect(store.pipelines).toHaveLength(2);
    expect(store.pipelines[0].id).toBe("ghost-id");
    expect(store.pipelines[1].id).toBe("existing-id");
  });
});
