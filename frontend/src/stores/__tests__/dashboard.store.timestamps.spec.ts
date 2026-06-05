import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "../dashboard.store";

describe("dashboard.store — pipeline-queue-timestamps", () => {
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
    status: "Running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    finalizedAt: null,
    ...overrides,
  });

  it("AC-16: handleSocketUpdated with startedAt merges startedAt into pipeline in store", () => {
    const store = useDashboardStore();
    const pipeline = makePipeline({
      id: "p1",
      status: "Queued",
      startedAt: null,
    });
    store.$patch({ pipelines: [pipeline as any] });

    const startedAt = new Date().toISOString();
    store.handleSocketUpdated({
      ...pipeline,
      status: "Running",
      startedAt,
    } as any);

    expect(store.pipelines[0].startedAt).toBe(startedAt);
  });

  it("AC-17: handleSocketUpdated with finalizedAt merges finalizedAt into pipeline in store", () => {
    const store = useDashboardStore();
    const pipeline = makePipeline({
      id: "p1",
      status: "Running",
      finalizedAt: null,
    });
    store.$patch({ pipelines: [pipeline as any] });

    const finalizedAt = new Date().toISOString();
    store.handleSocketUpdated({
      ...pipeline,
      status: "Completed",
      finalizedAt,
    } as any);

    expect(store.pipelines[0].finalizedAt).toBe(finalizedAt);
  });

  it("AC-16/17: startedAt and finalizedAt null when not provided in initial pipeline", () => {
    const store = useDashboardStore();
    const pipeline = makePipeline({ id: "p1", status: "Queued" });
    store.$patch({ pipelines: [pipeline as any] });

    expect(store.pipelines[0].startedAt).toBeNull();
    expect(store.pipelines[0].finalizedAt).toBeNull();
  });
});
