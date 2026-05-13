import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import AppLayout from "../AppLayout.vue";

describe("AppLayout", () => {
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

  function mountLayout(userOverrides: Partial<Record<string, unknown>> = {}) {
    const defaultUser = {
      id: "user-1",
      name: "Pedro Miranda",
      email: "pedro@example.com",
      root: false,
      del: false,
      ...userOverrides,
    };

    return mount(AppLayout, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              auth: {
                accessToken: "mock-token",
                refreshToken: "mock-refresh",
                user: defaultUser,
              },
            },
          }),
        ],
        stubs: {
          RouterLink: {
            template: `<a :data-test="$attrs['data-test']"><slot /></a>`,
            inheritAttrs: false,
          },
          RouterView: true,
        },
      },
      slots: {
        default: "<div>Page content</div>",
      },
    });
  }

  it('renders [data-test="dashboard-link"] for all users', () => {
    // Arrange
    const wrapper = mountLayout({ root: false });

    // Assert
    expect(wrapper.find('[data-test="dashboard-link"]').exists()).toBe(true);
  });

  it('renders [data-test="profile-link"] for all users', () => {
    // Arrange
    const wrapper = mountLayout({ root: false });

    // Assert
    expect(wrapper.find('[data-test="profile-link"]').exists()).toBe(true);
  });

  it('AC-17: does NOT render [data-test="users-link"] for non-root user', () => {
    // Arrange
    const wrapper = mountLayout({ root: false });

    // Assert
    expect(wrapper.find('[data-test="users-link"]').exists()).toBe(false);
  });

  it('AC-17: renders [data-test="users-link"] for root user', () => {
    // Arrange
    const wrapper = mountLayout({ root: true });

    // Assert
    expect(wrapper.find('[data-test="users-link"]').exists()).toBe(true);
  });

  it('[data-test="side-menu"] exists (visible on desktop via Bootstrap)', () => {
    // Arrange
    const wrapper = mountLayout();

    // Assert
    expect(wrapper.find('[data-test="side-menu"]').exists()).toBe(true);
  });

  it('[data-test="bottom-menu"] exists (visible on mobile via Bootstrap)', () => {
    // Arrange
    const wrapper = mountLayout();

    // Assert
    expect(wrapper.find('[data-test="bottom-menu"]').exists()).toBe(true);
  });

  it("side-menu contains dashboard-link, profile-link", () => {
    // Arrange
    const wrapper = mountLayout();
    const sideMenu = wrapper.find('[data-test="side-menu"]');

    // Assert
    expect(sideMenu.find('[data-test="dashboard-link"]').exists()).toBe(true);
    expect(sideMenu.find('[data-test="profile-link"]').exists()).toBe(true);
  });

  it("root user: side-menu also contains users-link", () => {
    // Arrange
    const wrapper = mountLayout({ root: true });
    const sideMenu = wrapper.find('[data-test="side-menu"]');

    // Assert
    expect(sideMenu.find('[data-test="users-link"]').exists()).toBe(true);
  });
});
