import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { flushPromises } from "@vue/test-utils";
import UsersView from "../UsersView.vue";

const mockRouterPush = vi.fn();

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: () => ({ push: mockRouterPush }),
    useRoute: () => ({ path: "/users", params: {}, query: {} }),
  };
});

describe("UsersView", () => {
  const rootUser = {
    id: "user-root",
    name: "Root User",
    email: "root@example.com",
    root: true,
    del: false,
  };

  const nonRootUser = {
    id: "user-1",
    name: "Pedro Miranda",
    email: "pedro@example.com",
    root: false,
    del: false,
  };

  const mockUsers = [
    {
      id: "user-2",
      name: "Alice Smith",
      email: "alice@example.com",
      profilePictureUrl: null,
      githubId: "alice",
      root: false,
      del: false,
    },
    {
      id: "user-3",
      name: "Bob Jones",
      email: "bob@example.com",
      profilePictureUrl: null,
      githubId: "bob",
      root: false,
      del: false,
    },
  ];

  beforeEach(() => {
    // @ts-ignore mock compatibility
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
    vi.stubGlobal("fetch", vi.fn());
    mockRouterPush.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountUsersView(currentUser = rootUser) {
    return mount(UsersView, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: true,
            initialState: {
              auth: {
                accessToken: "mock-token",
                refreshToken: "mock-refresh",
                user: currentUser,
              },
              users: {
                users: mockUsers,
                total: 2,
                page: 1,
                limit: 10,
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
          EditUserModal: {
            template: `<div v-if="visible" data-test="edit-modal"><slot /></div>`,
            props: ["visible", "user"],
          },
        },
      },
    });
  }

  it("AC-18: if user is not root, router guard redirects to /", async () => {
    // Arrange
    mountUsersView(nonRootUser);
    await flushPromises();

    // Assert — non-root user should be redirected away from /users
    expect(mockRouterPush).toHaveBeenCalledWith("/");
  });

  it('AC-19: root user sees [...] button [data-test="actions-menu"] for each user row', async () => {
    // Arrange
    const wrapper = mountUsersView(rootUser);
    await flushPromises();

    // Assert
    const actionMenus = wrapper.findAll('[data-test="actions-menu"]');
    expect(actionMenus.length).toBeGreaterThanOrEqual(1);
  });

  it('AC-19: clicking [...] and Edit opens [data-test="edit-modal"]', async () => {
    // Arrange
    const wrapper = mountUsersView(rootUser);
    await flushPromises();

    // Act
    const firstActionsMenu = wrapper.find('[data-test="actions-menu"]');
    await firstActionsMenu.trigger("click");
    await flushPromises();

    const editButton = wrapper.find('[data-test="edit-action"]');
    await editButton.trigger("click");
    await flushPromises();

    // Assert
    expect(wrapper.find('[data-test="edit-modal"]').exists()).toBe(true);
  });

  it('search input [data-test="search"] triggers store.fetchUsers with search param', async () => {
    // Arrange
    const wrapper = mountUsersView(rootUser);
    await flushPromises();

    const { useUsersStore } = await import("../../stores/users.store");
    const store = useUsersStore();

    // Act
    const searchInput = wrapper.find('[data-test="search"]');
    await searchInput.setValue("alice");
    await searchInput.trigger("input");
    await flushPromises();

    // Assert
    expect(store.fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: "alice" }),
    );
  });

  it('del filter [data-test="del-filter"] defaults to "false" (show only non-deleted)', async () => {
    // Arrange
    const wrapper = mountUsersView(rootUser);
    await flushPromises();

    // Assert
    const delFilter = wrapper.find('[data-test="del-filter"]');
    expect(delFilter.exists()).toBe(true);
    const value = (delFilter.element as HTMLSelectElement | HTMLInputElement)
      .value;
    expect(value).toBe("false");
  });

  it('non-root user: [data-test="actions-menu"] is not rendered', async () => {
    // Arrange
    const wrapper = mountUsersView(nonRootUser);
    await flushPromises();

    // Assert — actions menu should not appear for non-root (they get redirected anyway,
    // but if somehow the view renders, actions must not be visible)
    const actionMenus = wrapper.findAll('[data-test="actions-menu"]');
    expect(actionMenus.length).toBe(0);
  });
});
