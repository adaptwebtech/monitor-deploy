import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "../auth.store";

describe("useAuthStore", () => {
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

  const mockUser = {
    id: "user-1",
    name: "Pedro Miranda",
    email: "pedro@example.com",
    root: false,
    del: false,
    profilePictureUrl: null,
    githubId: null,
  };

  const mockLoginResponse = {
    accessToken: "access-token-abc",
    refreshToken: "refresh-token-xyz",
    user: mockUser,
  };

  it("login(): calls POST /auth/login, stores accessToken + refreshToken + user in state", async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockLoginResponse,
    } as Response);

    const store = useAuthStore();

    // Act
    await store.login("pedro@example.com", "password123");

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/auth/login",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"pedro@example.com"'),
      }),
    );
    expect(store.accessToken).toBe("access-token-abc");
    expect(store.refreshToken).toBe("refresh-token-xyz");
    expect(store.user).toEqual(mockUser);
  });

  it("login(): on 401 response, throws error and does not update state", async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    const store = useAuthStore();

    // Act & Assert
    await expect(store.login("bad@example.com", "wrongpass")).rejects.toThrow();
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.user).toBeNull();
  });

  it("logout(): clears accessToken, refreshToken, user", async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockLoginResponse,
    } as Response);

    const store = useAuthStore();
    await store.login("pedro@example.com", "password123");
    expect(store.accessToken).toBe("access-token-abc");

    // Act
    store.logout();

    // Assert
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.user).toBeNull();
  });

  it("refresh(): calls POST /auth/refresh with refreshToken, updates accessToken", async () => {
    // Arrange
    const store = useAuthStore();
    store.$patch({ refreshToken: "old-refresh-token" });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "new-access-token" }),
    } as Response);

    // Act
    await store.refresh();

    // Assert
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("old-refresh-token"),
      }),
    );
    expect(store.accessToken).toBe("new-access-token");
  });

  it("isAuthenticated getter: true when accessToken exists", () => {
    // Arrange
    const store = useAuthStore();
    store.$patch({ accessToken: "some-token" });

    // Assert
    expect(store.isAuthenticated).toBe(true);
  });

  it("isAuthenticated getter: false when accessToken is null", () => {
    // Arrange
    const store = useAuthStore();
    store.$patch({ accessToken: null });

    // Assert
    expect(store.isAuthenticated).toBe(false);
  });

  it("isRoot getter: true when user.root === true", () => {
    // Arrange
    const store = useAuthStore();
    store.$patch({ user: { ...mockUser, root: true } });

    // Assert
    expect(store.isRoot).toBe(true);
  });

  it("isRoot getter: false when user.root === false", () => {
    // Arrange
    const store = useAuthStore();
    store.$patch({ user: { ...mockUser, root: false } });

    // Assert
    expect(store.isRoot).toBe(false);
  });

  it("isRoot getter: false when user is null", () => {
    // Arrange
    const store = useAuthStore();
    store.$patch({ user: null });

    // Assert
    expect(store.isRoot).toBe(false);
  });

  it("does NOT check refreshToken expiry (no expiresIn or expiry logic in refresh flow)", async () => {
    // Arrange — refresh token has no expiry; store should call the API regardless of time
    const store = useAuthStore();
    // Patch with a refresh token that would be "expired" if expiry were checked (issued long ago)
    store.$patch({
      refreshToken: "long-lived-refresh-token",
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "fresh-access-token" }),
    } as Response);

    // Act — should not throw or skip due to "expiry"
    await store.refresh();

    // Assert — API was called (no expiry short-circuit)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.any(Object),
    );
    expect(store.accessToken).toBe("fresh-access-token");
  });
});
