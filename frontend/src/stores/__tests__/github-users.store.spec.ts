import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGithubUsersStore } from "../github-users.store";

vi.mock("../../lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../../lib/apiFetch";

describe("useGithubUsersStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // @ts-ignore -- window.config is runtime-injected, not in TS lib types
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeGithubUser = (overrides = {}) => ({
    name: "Pedro Miranda",
    profilePictureUrl: "https://avatars.githubusercontent.com/u/1234567",
    ...overrides,
  });

  it("AC-7: resolveIds with 200 response → getResolved returns { name, profilePictureUrl }", async () => {
    // Arrange
    const resolvedUser = makeGithubUser();
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => resolvedUser,
    } as Response);

    const store = useGithubUsersStore();

    // Act
    await store.resolveIds(["pedro-php"]);

    // Assert
    expect(store.getResolved("pedro-php")).toEqual({
      name: "Pedro Miranda",
      profilePictureUrl: "https://avatars.githubusercontent.com/u/1234567",
    });
  });

  it("AC-8: resolveIds with 404 response → getResolved returns null", async () => {
    // Arrange
    vi.mocked(apiFetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    } as Response);

    const store = useGithubUsersStore();

    // Act
    await store.resolveIds(["unknown"]);

    // Assert
    expect(store.getResolved("unknown")).toBeNull();
  });

  it("AC-9: resolveIds called twice with same githubId → apiFetch called only once", async () => {
    // Arrange
    const resolvedUser = makeGithubUser();
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => resolvedUser,
    } as Response);

    const store = useGithubUsersStore();

    // Act
    await store.resolveIds(["pedro-php"]);
    await store.resolveIds(["pedro-php"]);

    // Assert
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
