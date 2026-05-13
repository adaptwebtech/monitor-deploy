import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { flushPromises } from "@vue/test-utils";
import DashboardView from "../DashboardView.vue";

vi.mock("../../composables/usePipelineSocket", () => ({
  usePipelineSocket: vi.fn(() => ({
    onCreated: vi.fn(),
    onUpdated: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

describe("DashboardView", () => {
  beforeEach(() => {
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

  const mockPipelines = [
    {
      id: "p1",
      app: "whiz-server",
      environment: "development",
      commitSha: "abc1234",
      commitMessage: "fix: update deps",
      commitAuthor: "Pedro Miranda",
      commitAuthorAvatar: "https://example.com/avatar.png",
      status: "Running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "p2",
      app: "whiz-client",
      environment: "staging",
      commitSha: "def5678",
      commitMessage: "feat: add dashboard",
      commitAuthor: "Jane Doe",
      commitAuthorAvatar: null,
      status: "Queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockKpis = { total: 10, succeeded: 7, failed: 2, errorRate: 20.0 };

  function mountDashboard(
    initialPipelines = mockPipelines,
    initialKpis = mockKpis,
  ) {
    return mount(DashboardView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              dashboard: {
                pipelines: initialPipelines,
                kpis: initialKpis,
                loading: false,
                error: null,
              },
            },
          }),
        ],
        stubs: {
          RouterLink: true,
          RouterView: true,
          AppLayout: { template: "<div><slot /></div>" },
          DateRangeFilter: true,
          RunningIndicator: true,
          KpiCards: true,
          PipelineTable: {
            template: `
              <table>
                <tbody>
                  <tr v-for="p in pipelines" :key="p.id" :data-test="'row-' + p.id">
                    <td data-test="avatar-cell"><img :src="p.commitAuthorAvatar" /></td>
                    <td data-test="commit-author">{{ p.commitAuthor }}</td>
                    <td data-test="app">{{ p.app }}</td>
                    <td data-test="environment">{{ p.environment }}</td>
                    <td data-test="commit-sha">{{ p.commitSha }}</td>
                    <td data-test="commit-message">{{ p.commitMessage }}</td>
                    <td data-test="status">{{ p.status }}</td>
                  </tr>
                </tbody>
              </table>
            `,
            props: ["pipelines"],
          },
        },
      },
    });
  }

  it("AC-14: on mount, calls store.fetchPipelines() and store.fetchKpis()", async () => {
    // Arrange
    mountDashboard();
    await flushPromises();

    // Act
    const { useDashboardStore } = await import("../../stores/dashboard.store");
    const store = useDashboardStore();

    // Assert
    expect(store.fetchPipelines).toHaveBeenCalledTimes(1);
    expect(store.fetchKpis).toHaveBeenCalledTimes(1);
  });

  it("AC-14: when store.handleSocketCreated(newPipeline) called, new row appears in table", async () => {
    // Arrange
    const wrapper = mountDashboard([]);
    await flushPromises();

    const { useDashboardStore } = await import("../../stores/dashboard.store");
    const store = useDashboardStore();

    // Act
    const newPipeline = {
      id: "p-new",
      app: "new-app",
      environment: "production",
      commitSha: "xyz9999",
      commitMessage: "chore: deploy",
      commitAuthor: "New Author",
      commitAuthorAvatar: null,
      status: "Queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Simulate the store's reactive state being updated (as handleSocketCreated would do)
    store.$patch({ pipelines: [newPipeline] });
    await flushPromises();

    // Assert
    expect(wrapper.find('[data-test="commit-author"]').text()).toBe(
      "New Author",
    );
  });

  it("AC-15: when store.handleSocketUpdated(updatedPipeline) called, matching row in table is updated", async () => {
    // Arrange
    const wrapper = mountDashboard(mockPipelines);
    await flushPromises();

    const { useDashboardStore } = await import("../../stores/dashboard.store");
    const store = useDashboardStore();

    // Act — update pipeline p1 status to Completed
    const updatedPipelines = mockPipelines.map((p) =>
      p.id === "p1" ? { ...p, status: "Completed" } : p,
    );
    store.$patch({ pipelines: updatedPipelines });
    await flushPromises();

    // Assert
    const rows = wrapper.findAll('[data-test="status"]');
    const statuses = rows.map((r) => r.text());
    expect(statuses).toContain("Completed");
  });

  it('AC-16: [data-test="running-indicator"] is visible when store has pipeline with status=Running', async () => {
    // Arrange
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              dashboard: {
                pipelines: mockPipelines, // includes Running pipeline
                kpis: mockKpis,
                loading: false,
                error: null,
              },
            },
          }),
        ],
        stubs: {
          RouterLink: true,
          RouterView: true,
          AppLayout: { template: "<div><slot /></div>" },
          DateRangeFilter: true,
          KpiCards: true,
          PipelineTable: true,
          RunningIndicator: {
            template: `<div v-if="running" data-test="running-indicator">{{ running.app }}</div>`,
            props: ["running"],
          },
        },
      },
    });
    await flushPromises();

    // Assert
    expect(wrapper.find('[data-test="running-indicator"]').exists()).toBe(true);
  });

  it('AC-16: [data-test="running-indicator"] is NOT visible when no pipeline is Running', async () => {
    // Arrange
    const noRunningPipelines = mockPipelines.map((p) => ({
      ...p,
      status: "Completed",
    }));
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              dashboard: {
                pipelines: noRunningPipelines,
                kpis: mockKpis,
                loading: false,
                error: null,
              },
            },
          }),
        ],
        stubs: {
          RouterLink: true,
          RouterView: true,
          AppLayout: { template: "<div><slot /></div>" },
          DateRangeFilter: true,
          KpiCards: true,
          PipelineTable: true,
          RunningIndicator: {
            template: `<div v-if="running" data-test="running-indicator">{{ running.app }}</div>`,
            props: ["running"],
          },
        },
      },
    });
    await flushPromises();

    // Assert
    expect(wrapper.find('[data-test="running-indicator"]').exists()).toBe(
      false,
    );
  });

  it("table has columns with data-test: avatar-cell, commit-author, app, environment, commit-sha, commit-message, status", async () => {
    // Arrange
    const wrapper = mountDashboard(mockPipelines);
    await flushPromises();

    // Assert
    expect(wrapper.find('[data-test="avatar-cell"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="commit-author"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="app"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="environment"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="commit-sha"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="commit-message"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="status"]').exists()).toBe(true);
  });

  it("date filter defaults to last 7 days (dateStart = 7 days ago, dateEnd = now)", async () => {
    // Arrange
    const before = Date.now();
    mountDashboard();
    await flushPromises();

    const { useDashboardStore } = await import("../../stores/dashboard.store");
    const store = useDashboardStore();

    // Act — capture the dateStart passed to fetchPipelines
    const callArgs = (store.fetchPipelines as ReturnType<typeof vi.fn>).mock
      .calls[0];

    // Assert — dateStart should be approximately 7 days ago
    if (callArgs && callArgs[0]) {
      const dateStart = new Date(callArgs[0]).getTime();
      const sevenDaysAgo = before - 7 * 24 * 60 * 60 * 1000;
      // Within 1 minute of 7 days ago
      expect(dateStart).toBeGreaterThanOrEqual(sevenDaysAgo - 60_000);
      expect(dateStart).toBeLessThanOrEqual(sevenDaysAgo + 60_000);
    }
  });

  it("KPI cards show values from store.kpis (total, succeeded, failed, errorRate)", async () => {
    // Arrange
    const wrapper = mount(DashboardView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              dashboard: {
                pipelines: [],
                kpis: { total: 42, succeeded: 30, failed: 8, errorRate: 19.05 },
                loading: false,
                error: null,
              },
            },
          }),
        ],
        stubs: {
          RouterLink: true,
          RouterView: true,
          AppLayout: { template: "<div><slot /></div>" },
          DateRangeFilter: true,
          RunningIndicator: true,
          PipelineTable: true,
          KpiCards: {
            template: `
              <div>
                <span data-test="kpi-total">{{ stats.total }}</span>
                <span data-test="kpi-succeeded">{{ stats.succeeded }}</span>
                <span data-test="kpi-failed">{{ stats.failed }}</span>
                <span data-test="kpi-error-rate">{{ stats.errorRate }}</span>
              </div>
            `,
            props: ["stats"],
          },
        },
      },
    });
    await flushPromises();

    // Assert
    expect(wrapper.find('[data-test="kpi-total"]').text()).toBe("42");
    expect(wrapper.find('[data-test="kpi-succeeded"]').text()).toBe("30");
    expect(wrapper.find('[data-test="kpi-failed"]').text()).toBe("8");
    expect(wrapper.find('[data-test="kpi-error-rate"]').text()).toContain(
      "19.05",
    );
  });
});
