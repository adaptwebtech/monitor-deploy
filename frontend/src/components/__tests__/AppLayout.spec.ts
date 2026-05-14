import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { useAuthStore } from "../../stores/auth.store";
import AppLayout from "../AppLayout.vue";

const mockPush = vi.fn();
vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return { ...actual, useRouter: () => ({ push: mockPush }) };
});

describe("AppLayout", () => {
  beforeEach(() => {
    // @ts-ignore mock compatibility
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
    vi.stubGlobal("fetch", vi.fn());
    mockPush.mockClear();
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

  // --- Logout button ---

  it("AC-1: side-menu renders exactly one logout button", () => {
    // Arrange
    const wrapper = mountLayout();
    const sideMenu = wrapper.find('[data-test="side-menu"]');

    // Assert
    expect(sideMenu.findAll('[data-test="logout-button"]')).toHaveLength(1);
  });

  it("AC-1: bottom-menu renders exactly one logout button", () => {
    // Arrange
    const wrapper = mountLayout();
    const bottomMenu = wrapper.find('[data-test="bottom-menu"]');

    // Assert
    expect(bottomMenu.findAll('[data-test="logout-button"]')).toHaveLength(1);
  });

  it("AC-2: side-menu logout button has text-danger and link-style classes", () => {
    // Arrange
    const wrapper = mountLayout();
    const btn = wrapper
      .find('[data-test="side-menu"]')
      .find('[data-test="logout-button"]');

    // Assert
    expect(btn.classes()).toContain("text-danger");
    expect(btn.classes()).toContain("py-1");
    expect(btn.classes()).toContain("px-2");
    expect(btn.classes()).toContain("rounded");
  });

  it("AC-3: bottom-menu logout button has text-danger class", () => {
    // Arrange
    const wrapper = mountLayout();
    const btn = wrapper
      .find('[data-test="bottom-menu"]')
      .find('[data-test="logout-button"]');

    // Assert
    expect(btn.classes()).toContain("text-danger");
  });

  it("AC-4: clicking logout button calls auth.logout() exactly once", async () => {
    // Arrange
    const wrapper = mountLayout();
    const auth = useAuthStore();

    // Act
    await wrapper.find('[data-test="logout-button"]').trigger("click");

    // Assert
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it("AC-5: clicking logout button calls router.push with { name: 'login' }", async () => {
    // Arrange
    const wrapper = mountLayout();

    // Act
    await wrapper.find('[data-test="logout-button"]').trigger("click");

    // Assert
    expect(mockPush).toHaveBeenCalledWith({ name: "login" });
  });

  it("AC-6: logout button visible for non-root user", () => {
    // Arrange
    const wrapper = mountLayout({ root: false });

    // Assert
    expect(
      wrapper
        .find('[data-test="side-menu"]')
        .find('[data-test="logout-button"]')
        .exists(),
    ).toBe(true);
  });

  it("AC-6: logout button visible for root user", () => {
    // Arrange
    const wrapper = mountLayout({ root: true });

    // Assert
    expect(
      wrapper
        .find('[data-test="side-menu"]')
        .find('[data-test="logout-button"]')
        .exists(),
    ).toBe(true);
  });
});
