import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import PipelineTable from "../PipelineTable.vue";
import type { PipelineQueue } from "../../types";

vi.mock("../../lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makePipeline = (
  overrides: Partial<PipelineQueue> = {},
): PipelineQueue => ({
  id: "pipeline-1",
  app: "my-app",
  environment: "production",
  commitSha: "abc1234def5678",
  commitMessage: "fix: bug fix",
  commitAuthor: "Pedro Miranda",
  commitAuthorAvatar: "https://github-cdn.com/pedro-fallback.png",
  commitAuthorId: "pedro-php",
  status: "Completed",
  createdAt: "2026-05-22T10:00:00.000Z",
  updatedAt: "2026-05-22T10:05:00.000Z",
  startedAt: null,
  finalizedAt: null,
  ...overrides,
});

function mountTable(
  pipelines: PipelineQueue[],
  githubUsersState: Record<string, unknown> = {},
) {
  return mount(PipelineTable, {
    props: { pipelines },
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            githubUsers: githubUsersState,
          },
          stubActions: false,
        }),
      ],
      stubs: {
        StatusBadge: true,
      },
    },
  });
}

describe("PipelineTable — github-user-picture", () => {
  it("AC-10: resolved user with profilePictureUrl → AvatarCell receives url=profilePictureUrl", async () => {
    // Arrange
    const profilePictureUrl = "https://avatars.githubusercontent.com/u/1234567";
    const pipeline = makePipeline({ commitAuthorId: "pedro-php" });
    const resolved = {
      "pedro-php": { name: "Pedro Miranda", profilePictureUrl },
    };

    // Act
    const wrapper = mountTable([pipeline], { resolved });
    await wrapper.vm.$nextTick();

    // Assert
    const avatarCell = wrapper.find('[data-test="avatar-cell"]');
    expect(avatarCell.attributes("url")).toBe(profilePictureUrl);
  });

  it("AC-11: resolved user with profilePictureUrl=null → AvatarCell receives url=commitAuthorAvatar", async () => {
    // Arrange
    const commitAuthorAvatar = "https://github-cdn.com/pedro-fallback.png";
    const pipeline = makePipeline({
      commitAuthorId: "pedro-php",
      commitAuthorAvatar,
    });
    const resolved = {
      "pedro-php": { name: "Pedro Miranda", profilePictureUrl: null },
    };

    // Act
    const wrapper = mountTable([pipeline], { resolved });
    await wrapper.vm.$nextTick();

    // Assert
    const avatarCell = wrapper.find('[data-test="avatar-cell"]');
    expect(avatarCell.attributes("url")).toBe(commitAuthorAvatar);
  });

  it("AC-12: pipeline.commitAuthorId=null → AvatarCell receives url=commitAuthorAvatar", async () => {
    // Arrange
    const commitAuthorAvatar = "https://github-cdn.com/fallback.png";
    const pipeline = makePipeline({ commitAuthorId: null, commitAuthorAvatar });

    // Act
    const wrapper = mountTable([pipeline], { resolved: {} });
    await wrapper.vm.$nextTick();

    // Assert
    const avatarCell = wrapper.find('[data-test="avatar-cell"]');
    expect(avatarCell.attributes("url")).toBe(commitAuthorAvatar);
  });

  it("AC-13: resolved user → author name cell shows user.name (not commitAuthor)", async () => {
    // Arrange
    const pipeline = makePipeline({
      commitAuthorId: "pedro-php",
      commitAuthor: "pedro-php",
    });
    const resolved = {
      "pedro-php": { name: "Pedro Miranda", profilePictureUrl: null },
    };

    // Act
    const wrapper = mountTable([pipeline], { resolved });
    await wrapper.vm.$nextTick();

    // Assert
    const authorCell = wrapper.find('[data-test="author-name"]');
    expect(authorCell.text()).toBe("Pedro Miranda");
  });

  it("AC-14: no matching resolved user → author name cell shows commitAuthor", async () => {
    // Arrange
    const pipeline = makePipeline({
      commitAuthorId: "unknown-user",
      commitAuthor: "Pedro Miranda",
    });

    // Act
    const wrapper = mountTable([pipeline], { resolved: {} });
    await wrapper.vm.$nextTick();

    // Assert
    const authorCell = wrapper.find('[data-test="author-name"]');
    expect(authorCell.text()).toBe("Pedro Miranda");
  });

  it("AC-15: network error during resolve → no thrown error, commitAuthorAvatar shown", async () => {
    // Arrange
    const commitAuthorAvatar = "https://github-cdn.com/fallback.png";
    const pipeline = makePipeline({
      commitAuthorId: "pedro-php",
      commitAuthorAvatar,
    });

    // Act — store has no resolved entry (simulates failed network fetch)
    let wrapper: ReturnType<typeof mountTable> | undefined;
    expect(() => {
      wrapper = mountTable([pipeline], {
        resolved: {},
        error: "Network error",
      });
    }).not.toThrow();

    await wrapper!.vm.$nextTick();

    // Assert
    const avatarCell = wrapper!.find('[data-test="avatar-cell"]');
    expect(avatarCell.attributes("url")).toBe(commitAuthorAvatar);
  });
});
