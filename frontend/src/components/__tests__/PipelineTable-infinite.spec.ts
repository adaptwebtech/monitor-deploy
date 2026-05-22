import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import PipelineTable from "../PipelineTable.vue";

// PipelineTable.vue needs new props: hasMore: boolean, loadingMore: boolean
// and must emit 'loadMore' when IntersectionObserver fires on the sentinel element.

// Mock IntersectionObserver globally — not available in jsdom
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
let intersectionCallback: IntersectionObserverCallback | null = null;

beforeEach(() => {
  intersectionCallback = null;
  mockObserve.mockClear();
  mockUnobserve.mockClear();
  mockDisconnect.mockClear();

  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation((cb: IntersectionObserverCallback) => {
      intersectionCallback = cb;
      return {
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
      };
    }),
  );
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

describe("PipelineTable — infinite scroll (AC-7)", () => {
  // ─── AC-7 ────────────────────────────────────────────────────────────────────

  it("AC-7: emits loadMore when IntersectionObserver fires on sentinel (hasMore=true)", async () => {
    const pipelines = Array.from({ length: 5 }, (_, i) =>
      makePipeline({ id: `p${i}` }),
    );

    const wrapper = mount(PipelineTable, {
      props: { pipelines, hasMore: true, loadingMore: false },
      global: { plugins: [createTestingPinia()] },
    });

    await wrapper.vm.$nextTick();

    // Sentinel must be observed
    expect(mockObserve).toHaveBeenCalled();

    // Simulate IntersectionObserver triggering (sentinel enters 300px threshold)
    expect(intersectionCallback).not.toBeNull();
    intersectionCallback!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("loadMore")).toBeTruthy();
    expect(wrapper.emitted("loadMore")).toHaveLength(1);
  });

  it("AC-7: does NOT emit loadMore when hasMore=false even if sentinel intersects", async () => {
    const pipelines = [makePipeline({ id: "p1" })];

    const wrapper = mount(PipelineTable, {
      props: { pipelines, hasMore: false, loadingMore: false },
      global: { plugins: [createTestingPinia()] },
    });

    await wrapper.vm.$nextTick();

    // Trigger the observer callback
    if (intersectionCallback) {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    }

    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("loadMore")).toBeFalsy();
  });

  it("AC-7: does NOT emit loadMore when loadingMore=true (concurrent guard)", async () => {
    const pipelines = Array.from({ length: 3 }, (_, i) =>
      makePipeline({ id: `p${i}` }),
    );

    const wrapper = mount(PipelineTable, {
      props: { pipelines, hasMore: true, loadingMore: true },
      global: { plugins: [createTestingPinia()] },
    });

    await wrapper.vm.$nextTick();

    if (intersectionCallback) {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    }

    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("loadMore")).toBeFalsy();
  });

  it("AC-7: sentinel element is present in the rendered output", async () => {
    const pipelines = [makePipeline({ id: "p1" })];

    const wrapper = mount(PipelineTable, {
      props: { pipelines, hasMore: true, loadingMore: false },
      global: { plugins: [createTestingPinia()] },
    });

    await wrapper.vm.$nextTick();

    // Sentinel element must be targetable — data-test="infinite-scroll-sentinel"
    const sentinel = wrapper.find("[data-test='infinite-scroll-sentinel']");
    expect(sentinel.exists()).toBe(true);
  });

  it("AC-7: IntersectionObserver is created with rootMargin containing 300px", async () => {
    const pipelines = [makePipeline({ id: "p1" })];

    mount(PipelineTable, {
      props: { pipelines, hasMore: true, loadingMore: false },
      global: { plugins: [createTestingPinia()] },
    });

    await new Promise((r) => setTimeout(r, 0));

    // Verify that the IntersectionObserver constructor was called with the correct options
    const IntersectionObserverMock = vi.mocked(
      window.IntersectionObserver as unknown as ReturnType<typeof vi.fn>,
    );
    expect(IntersectionObserverMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        rootMargin: "0px 0px 300px 0px",
      }),
    );
  });

  it("AC-7: shows loadingMore indicator when loadingMore=true", async () => {
    const pipelines = [makePipeline({ id: "p1" })];

    const wrapper = mount(PipelineTable, {
      props: { pipelines, hasMore: true, loadingMore: true },
      global: { plugins: [createTestingPinia()] },
    });

    await wrapper.vm.$nextTick();

    const loadingIndicator = wrapper.find("[data-test='loading-more']");
    expect(loadingIndicator.exists()).toBe(true);
  });

  it("AC-7: renders all pipeline items passed as props", async () => {
    const pipelines = Array.from({ length: 3 }, (_, i) =>
      makePipeline({ id: `p${i}`, app: `app-${i}` }),
    );

    const wrapper = mount(PipelineTable, {
      props: { pipelines, hasMore: false, loadingMore: false },
      global: { plugins: [createTestingPinia()] },
    });

    await wrapper.vm.$nextTick();

    // Each pipeline row must be rendered — data-test="pipeline-row"
    const rows = wrapper.findAll("[data-test='pipeline-row']");
    expect(rows).toHaveLength(3);
  });
});
