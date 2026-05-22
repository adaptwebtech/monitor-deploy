import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import DashboardView from "../DashboardView.vue";

// ─── Socket mock ─────────────────────────────────────────────────────────────
// We need fine-grained control over the "connect" event to simulate reconnects,
// so we keep a reference to all registered socket.on handlers.

const socketHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

const mockSocket = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!socketHandlers[event]) socketHandlers[event] = [];
    socketHandlers[event].push(handler);
  }),
  off: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock("../../lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emitSocketEvent(event: string, ...args: unknown[]) {
  (socketHandlers[event] ?? []).forEach((h) => h(...args));
}

function buildStubs() {
  return {
    RouterLink: true,
    RouterView: true,
    AppLayout: { template: "<div><slot /></div>" },
    DateRangeFilter: true,
    RunningIndicator: true,
    KpiCards: true,
    PipelineTable: true,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DashboardView — regression tests (ws-completion)", () => {
  beforeEach(() => {
    // Clear handler registry between tests
    for (const key of Object.keys(socketHandlers)) {
      delete socketHandlers[key];
    }
    mockSocket.on.mockClear();
    mockSocket.disconnect.mockClear();

    // @ts-ignore mock compatibility
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── REG-3 ──────────────────────────────────────────────────────────────────
  it("REG-3: onMounted triggers fetchInitial exactly once despite $patch changing dateRange", async () => {
    // Arrange — real pinia so the watcher in DashboardView fires for real
    const pinia = createPinia();
    setActivePinia(pinia);

    const { apiFetch } = await import("../../lib/apiFetch");
    const apiFetchMock = apiFetch as ReturnType<typeof vi.fn>;
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 100 }),
    } as unknown as Response);

    // Spy on fetchInitial after store is created inside mount
    // We patch it at store level once DashboardView creates the store instance.
    // Strategy: intercept apiFetch calls to /pipeline-queue that include page=1
    // (that is the signature of fetchInitial) and count how many times it fires.

    // Act
    mount(DashboardView, {
      global: {
        plugins: [pinia],
        stubs: buildStubs(),
      },
    });

    await flushPromises();
    // Give watcher micro-task queue time to settle
    await new Promise((r) => setTimeout(r, 0));
    await flushPromises();

    // Count calls to fetchInitial — identified by the `page=1` query param
    // (fetchPipelines uses a different URL without page=)
    const fetchInitialCalls = apiFetchMock.mock.calls.filter(
      ([url]: [string]) =>
        typeof url === "string" &&
        url.includes("page=1") &&
        url.includes("pipeline-queue"),
    );

    // Current code: watcher fires once on $patch + mount calls fetchInitial once = 2 calls → RED
    // Fixed code: watcher is suppressed during initial mount = exactly 1 call → GREEN
    expect(fetchInitialCalls).toHaveLength(1);
  });

  // ── REG-5 ──────────────────────────────────────────────────────────────────
  it("REG-5: socket reconnect (second connect event) calls dashboardStore.fetchInitial()", async () => {
    // Arrange — real pinia, real store so we can spy on fetchInitial
    const pinia = createPinia();
    setActivePinia(pinia);

    const { apiFetch } = await import("../../lib/apiFetch");
    const apiFetchMock = apiFetch as ReturnType<typeof vi.fn>;
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, limit: 100 }),
    } as unknown as Response);

    const { useDashboardStore } = await import("../../stores/dashboard.store");

    mount(DashboardView, {
      global: {
        plugins: [pinia],
        stubs: buildStubs(),
      },
    });

    await flushPromises();

    const store = useDashboardStore();
    const fetchInitialSpy = vi
      .spyOn(store, "fetchInitial")
      .mockResolvedValue(undefined);

    // Act — simulate a reconnect: socket emits "connect" a second time
    // Current code: no "connect" handler registered in usePipelineSocket → RED
    emitSocketEvent("connect");

    await flushPromises();

    // Assert — fetchInitial must have been called at least once after reconnect
    expect(fetchInitialSpy).toHaveBeenCalledTimes(1);
  });
});
