import { describe, it, expect, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import PipelineTable, { stripMergeLine } from "../PipelineTable.vue";
import type { PipelineQueue } from "../../types";

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function makePipeline(overrides: Partial<PipelineQueue> = {}): PipelineQueue {
  return {
    id: "pipeline-1",
    app: "my-app",
    environment: "production",
    commitSha: "abc1234def5678",
    commitMessage: "fix: corrige bug crítico no deploy",
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

function mountTable(pipelines: PipelineQueue[]) {
  return mount(PipelineTable, {
    props: { pipelines },
    global: {
      plugins: [createTestingPinia()],
      stubs: {
        AvatarCell: true,
        StatusBadge: true,
      },
    },
  });
}

describe("PipelineTable — dashboard-message-tooltip", () => {
  it('AC-1: Given pipeline with long commitMessage, when rendered, then span inside [data-test="commit-message"] has class text-truncate and style containing max-width: 220px', () => {
    // Arrange
    const pipeline = makePipeline({
      commitMessage:
        "feat: implementa sistema de notificações em tempo real para monitoramento de deploys",
    });

    // Act
    const wrapper = mountTable([pipeline]);

    // Assert
    const cell = wrapper.find('[data-test="commit-message"]');
    const span = cell.find("span");
    expect(span.exists()).toBe(true);
    expect(span.classes()).toContain("text-truncate");
    expect(span.attributes("style")).toContain("max-width: 220px");
  });

  it('AC-2: Given pipeline with commitMessage = "fix: corrige bug crítico no deploy", when rendered, then title attribute of span inside [data-test="commit-message"] equals that message', () => {
    // Arrange
    const message = "fix: corrige bug crítico no deploy";
    const pipeline = makePipeline({ commitMessage: message });

    // Act
    const wrapper = mountTable([pipeline]);

    // Assert
    const cell = wrapper.find('[data-test="commit-message"]');
    const span = cell.find("span");
    expect(span.exists()).toBe(true);
    expect(span.attributes("title")).toBe(message);
  });

  it('AC-3: Given pipeline with commitMessage = "", when rendered, then title attribute of span inside [data-test="commit-message"] is "" and no error is thrown', () => {
    // Arrange
    const pipeline = makePipeline({ commitMessage: "" });

    // Act
    let wrapper: ReturnType<typeof mountTable> | undefined;
    expect(() => {
      wrapper = mountTable([pipeline]);
    }).not.toThrow();

    // Assert
    const cell = wrapper!.find('[data-test="commit-message"]');
    const span = cell.find("span");
    expect(span.exists()).toBe(true);
    expect(span.attributes("title")).toBe("");
  });
});

describe("PipelineTable — stripMergeLine (characterization)", () => {
  it("CHAR-1: stripMergeLine com mensagem de merge padrão do GitHub retorna apenas a mensagem real", () => {
    const input = "Merge pull request #42 from org/branch\n\nmensagem real";
    expect(stripMergeLine(input)).toBe("mensagem real");
  });

  it("CHAR-2: stripMergeLine com mensagem simples retorna a mensagem inalterada", () => {
    const input = "feat: adiciona feature X";
    expect(stripMergeLine(input)).toBe("feat: adiciona feature X");
  });

  it("CHAR-3: stripMergeLine com string vazia retorna string vazia sem lançar erro", () => {
    expect(() => stripMergeLine("")).not.toThrow();
    expect(stripMergeLine("")).toBe("");
  });

  it('CHAR-4: span [data-test="commit-message"] tem atributo title com valor normalizado quando mensagem é merge PR', () => {
    const pipeline = makePipeline({
      commitMessage: "Merge pull request #42 from org/branch\n\nmensagem real",
    });
    const wrapper = mountTable([pipeline]);
    const span = wrapper.find('[data-test="commit-message"] span');
    expect(span.exists()).toBe(true);
    expect(span.attributes("title")).toBe("mensagem real");
    expect(span.attributes("title")).not.toContain("Merge pull request");
  });

  it('CHAR-5: span [data-test="commit-message"] exibe texto normalizado (não exibe linha Merge pull request)', () => {
    const pipeline = makePipeline({
      commitMessage: "Merge pull request #42 from org/branch\n\nmensagem real",
    });
    const wrapper = mountTable([pipeline]);
    const span = wrapper.find('[data-test="commit-message"] span');
    expect(span.exists()).toBe(true);
    expect(span.text()).toBe("mensagem real");
    expect(span.text()).not.toContain("Merge pull request");
  });
});
