import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { flushPromises } from "@vue/test-utils";
import LoginView from "../LoginView.vue";

const mockPush = vi.fn();

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
  };
});

describe("LoginView", () => {
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

  function mountLoginView() {
    return mount(LoginView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: false,
            initialState: {
              auth: {
                accessToken: null,
                refreshToken: null,
                user: null,
              },
            },
          }),
        ],
        stubs: {
          RouterLink: true,
          RouterView: true,
        },
      },
    });
  }

  it('renders email input [data-test="email"]', () => {
    // Arrange
    const wrapper = mountLoginView();

    // Assert
    expect(wrapper.find('[data-test="email"]').exists()).toBe(true);
  });

  it('renders password input [data-test="password"]', () => {
    // Arrange
    const wrapper = mountLoginView();

    // Assert
    expect(wrapper.find('[data-test="password"]').exists()).toBe(true);
  });

  it('renders submit button [data-test="submit"]', () => {
    // Arrange
    const wrapper = mountLoginView();

    // Assert
    expect(wrapper.find('[data-test="submit"]').exists()).toBe(true);
  });

  it("AC-13: on valid submit, calls auth store login() and redirects to /", async () => {
    // Arrange
    const wrapper = mountLoginView();
    const { useAuthStore } = await import("../../stores/auth.store");
    const authStore = useAuthStore();
    // @ts-ignore mock compatibility
    authStore.login = vi.fn().mockResolvedValue(undefined);

    await wrapper.find('[data-test="email"]').setValue("user@example.com");
    await wrapper.find('[data-test="password"]').setValue("password123");

    // Act
    await wrapper.find('[data-test="submit"]').trigger("click");
    await flushPromises();

    // Assert
    expect(authStore.login).toHaveBeenCalledWith(
      "user@example.com",
      "password123",
    );
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it('AC-13: on failed login (auth store throws), shows error message [data-test="error"]', async () => {
    // Arrange
    const wrapper = mountLoginView();
    const { useAuthStore } = await import("../../stores/auth.store");
    const authStore = useAuthStore();
    // @ts-ignore mock compatibility
    authStore.login = vi
      .fn()
      .mockRejectedValue(new Error("Invalid credentials"));

    await wrapper.find('[data-test="email"]').setValue("bad@example.com");
    await wrapper.find('[data-test="password"]').setValue("wrongpass");

    // Act
    await wrapper.find('[data-test="submit"]').trigger("click");
    await flushPromises();

    // Assert
    expect(wrapper.find('[data-test="error"]').exists()).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders left image [data-test="login-image"] on desktop', () => {
    // Arrange
    const wrapper = mountLoginView();

    // Assert
    expect(wrapper.find('[data-test="login-image"]').exists()).toBe(true);
  });

  it("left image has Bootstrap classes that hide it on mobile (d-none d-md-block)", () => {
    // Arrange
    const wrapper = mountLoginView();

    // Act
    const loginImage = wrapper.find('[data-test="login-image"]');

    // Assert
    // FR-18: image is hidden on mobile via Bootstrap responsive classes
    const classes = loginImage.classes();
    // The image container must carry d-none so it is hidden on xs/sm
    expect(
      classes.includes("d-none") ||
        loginImage.attributes("class")?.includes("d-none"),
    ).toBe(true);

    // And d-md-block (or d-md-flex / d-lg-block) to appear on md+
    const classAttr = loginImage.attributes("class") ?? "";
    expect(
      classAttr.includes("d-md-block") ||
        classAttr.includes("d-md-flex") ||
        classAttr.includes("d-lg-block"),
    ).toBe(true);
  });
});
