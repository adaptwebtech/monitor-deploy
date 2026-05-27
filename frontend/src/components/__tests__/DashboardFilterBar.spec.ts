import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { useDashboardStore } from "../../stores/dashboard.store";
// @ts-expect-error component does not exist yet — tests must be RED
import DashboardFilterBar from "../DashboardFilterBar.vue";

describe("DashboardFilterBar", () => {
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

  function mountComponent(storeOverrides: Record<string, unknown> = {}) {
    return mount(DashboardFilterBar, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              dashboard: {
                filterApp: "",
                filterEnvironment: "",
                filterStatus: "",
                hasActiveFilters: false,
                ...storeOverrides,
              },
            },
          }),
        ],
      },
    });
  }

  it("AC-6: renders app input, environment select, and status select with empty default values", () => {
    const wrapper = mountComponent();

    const appInput = wrapper.find('[data-test="filter-app"]');
    const envSelect = wrapper.find('[data-test="filter-environment"]');
    const statusSelect = wrapper.find('[data-test="filter-status"]');

    expect(appInput.exists()).toBe(true);
    expect(envSelect.exists()).toBe(true);
    expect(statusSelect.exists()).toBe(true);

    expect((appInput.element as HTMLInputElement).value).toBe("");
    expect((envSelect.element as HTMLSelectElement).value).toBe("");
    expect((statusSelect.element as HTMLSelectElement).value).toBe("");
  });

  it("AC-6: clear-filters button does NOT exist when no filters are active", () => {
    const wrapper = mountComponent({ hasActiveFilters: false });

    expect(wrapper.find('[data-test="clear-filters"]').exists()).toBe(false);
  });

  it("AC-10: clear-filters button exists when hasActiveFilters is true", () => {
    const wrapper = mountComponent({ hasActiveFilters: true });

    expect(wrapper.find('[data-test="clear-filters"]').exists()).toBe(true);
  });

  it("AC-10: clicking clear-filters button calls store.clearFilters()", async () => {
    const wrapper = mountComponent({ hasActiveFilters: true });
    const store = useDashboardStore();

    await wrapper.find('[data-test="clear-filters"]').trigger("click");

    expect(store.clearFilters).toHaveBeenCalledTimes(1);
  });

  it("AC-7: changing environment select to production calls store.setFilters({ environment: 'production' })", async () => {
    const wrapper = mountComponent();
    const store = useDashboardStore();

    await wrapper.find('[data-test="filter-environment"]').setValue("production");

    expect(store.setFilters).toHaveBeenCalledWith({ environment: "production" });
  });

  it("AC-8: changing status select to Failed calls store.setFilters({ status: 'Failed' })", async () => {
    const wrapper = mountComponent();
    const store = useDashboardStore();

    await wrapper.find('[data-test="filter-status"]').setValue("Failed");

    expect(store.setFilters).toHaveBeenCalledWith({ status: "Failed" });
  });
});
