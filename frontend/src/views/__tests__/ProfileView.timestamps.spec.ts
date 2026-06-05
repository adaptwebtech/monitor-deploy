import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import ProfileView from "../ProfileView.vue";
import type { PipelineQueue } from "../../types";

describe("ProfileView — pipeline-queue-timestamps", () => {
  const mockUser = {
    id: "user-1",
    name: "Pedro Miranda",
    email: "pedro@example.com",
    profilePictureUrl: null,
    githubId: "pedromiranda",
    root: false,
    del: false,
  };

  function makeHistoryItem(
    overrides: Partial<PipelineQueue> = {},
  ): PipelineQueue {
    return {
      id: "p1",
      app: "whiz-server",
      environment: "development",
      commitSha: "abc1234",
      commitMessage: "fix: deps",
      commitAuthor: "Pedro Miranda",
      commitAuthorAvatar: null,
      status: "Completed",
      createdAt: "2026-05-22T10:00:00.000Z",
      updatedAt: "2026-05-22T10:05:00.000Z",
      startedAt: null,
      finalizedAt: null,
      ...overrides,
    };
  }

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

  function mountProfile(history: PipelineQueue[] = [makeHistoryItem()]) {
    return mount(ProfileView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              auth: {
                accessToken: "mock-token",
                refreshToken: "mock-refresh",
                user: mockUser,
              },
              profile: {
                history,
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
        },
      },
    });
  }

  it("AC-15: history table has 'Criado' column header", async () => {
    const wrapper = mountProfile();
    await flushPromises();
    const table = wrapper.find('[data-test="history-table"]');
    expect(table.exists()).toBe(true);
    const headers = table.findAll("thead th");
    const headerTexts = headers.map((h) => h.text());
    expect(headerTexts).toContain("Criado");
  });

  it("AC-15: history table has col-header-started-at with label 'Início'", async () => {
    const wrapper = mountProfile();
    await flushPromises();
    const th = wrapper.find('[data-test="col-header-started-at"]');
    expect(th.exists()).toBe(true);
    expect(th.text()).toBe("Início");
  });

  it("AC-15: history table has col-header-finalized-at with label 'Fim'", async () => {
    const wrapper = mountProfile();
    await flushPromises();
    const th = wrapper.find('[data-test="col-header-finalized-at"]');
    expect(th.exists()).toBe(true);
    expect(th.text()).toBe("Fim");
  });

  it("AC-15: when startedAt is null, started-at cell shows en-dash", async () => {
    const wrapper = mountProfile([makeHistoryItem({ startedAt: null })]);
    await flushPromises();
    const cell = wrapper.find('[data-test="started-at"]');
    expect(cell.exists()).toBe(true);
    expect(cell.text().trim()).toBe("–");
  });

  it("AC-15: when startedAt is non-null, started-at cell shows formatted date", async () => {
    const startedAt = "2026-05-22T10:01:00.000Z";
    const wrapper = mountProfile([makeHistoryItem({ startedAt })]);
    await flushPromises();
    const cell = wrapper.find('[data-test="started-at"]');
    expect(cell.exists()).toBe(true);
    expect(cell.text().trim()).not.toBe("–");
  });

  it("AC-15: when finalizedAt is null, finalized-at cell shows en-dash", async () => {
    const wrapper = mountProfile([makeHistoryItem({ finalizedAt: null })]);
    await flushPromises();
    const cell = wrapper.find('[data-test="finalized-at"]');
    expect(cell.exists()).toBe(true);
    expect(cell.text().trim()).toBe("–");
  });

  it("AC-15: when finalizedAt is non-null, finalized-at cell shows formatted date", async () => {
    const finalizedAt = "2026-05-22T10:10:00.000Z";
    const wrapper = mountProfile([makeHistoryItem({ finalizedAt })]);
    await flushPromises();
    const cell = wrapper.find('[data-test="finalized-at"]');
    expect(cell.exists()).toBe(true);
    expect(cell.text().trim()).not.toBe("–");
  });
});
