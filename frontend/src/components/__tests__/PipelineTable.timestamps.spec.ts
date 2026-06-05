import { describe, it, expect, beforeAll, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PipelineTable from "../PipelineTable.vue";
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
    commitMessage: "fix: timestamps",
    commitAuthor: "Dev",
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
      stubs: {
        AvatarCell: true,
        StatusBadge: true,
      },
    },
  });
}

describe("PipelineTable — pipeline-queue-timestamps", () => {
  it("AC-14: column header for createdAt is labeled 'Criado'", () => {
    const wrapper = mountTable([makePipeline()]);
    const headers = wrapper.findAll("thead th");
    const headerTexts = headers.map((h) => h.text());
    expect(headerTexts).toContain("Criado");
  });

  it("AC-11/14: col-header-started-at exists with label 'Início'", () => {
    const wrapper = mountTable([makePipeline()]);
    const th = wrapper.find('[data-test="col-header-started-at"]');
    expect(th.exists()).toBe(true);
    expect(th.text()).toBe("Início");
  });

  it("AC-11/14: col-header-finalized-at exists with label 'Fim'", () => {
    const wrapper = mountTable([makePipeline()]);
    const th = wrapper.find('[data-test="col-header-finalized-at"]');
    expect(th.exists()).toBe(true);
    expect(th.text()).toBe("Fim");
  });

  it("AC-11: when startedAt is non-null, started-at cell shows formatted date", () => {
    const startedAt = "2026-05-22T10:01:00.000Z";
    const wrapper = mountTable([makePipeline({ startedAt })]);
    const cell = wrapper.find('[data-test="started-at"]');
    expect(cell.exists()).toBe(true);
    const text = cell.text().trim();
    expect(text).not.toBe("–");
    expect(text.length).toBeGreaterThan(0);
  });

  it("AC-12: when startedAt is null, started-at cell shows en-dash", () => {
    const wrapper = mountTable([makePipeline({ startedAt: null })]);
    const cell = wrapper.find('[data-test="started-at"]');
    expect(cell.exists()).toBe(true);
    expect(cell.text().trim()).toBe("–");
  });

  it("AC-13: when finalizedAt is null, finalized-at cell shows en-dash", () => {
    const wrapper = mountTable([makePipeline({ finalizedAt: null })]);
    const cell = wrapper.find('[data-test="finalized-at"]');
    expect(cell.exists()).toBe(true);
    expect(cell.text().trim()).toBe("–");
  });

  it("AC-13: when finalizedAt is non-null, finalized-at cell shows formatted date", () => {
    const finalizedAt = "2026-05-22T10:10:00.000Z";
    const wrapper = mountTable([makePipeline({ finalizedAt })]);
    const cell = wrapper.find('[data-test="finalized-at"]');
    expect(cell.exists()).toBe(true);
    const text = cell.text().trim();
    expect(text).not.toBe("–");
    expect(text.length).toBeGreaterThan(0);
  });
});
