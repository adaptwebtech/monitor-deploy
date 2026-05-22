import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { vi } from "vitest";
import PipelineTable from "./PipelineTable.vue";

// PipelineTable currently does NOT accept total/page/limit props nor
// does it emit update:page / update:limit — these tests are RED by design.

const defaultProps = {
  pipelines: [],
  total: 0,
  page: 1,
  limit: 10,
};

function mountTable(props: Partial<typeof defaultProps> = {}) {
  return mount(PipelineTable, {
    props: { ...defaultProps, ...props },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: {
        AvatarCell: true,
        StatusBadge: true,
        RunningIndicator: true,
      },
    },
  });
}

describe("PipelineTable — paginação (AC-8 a AC-14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-8: total=42, page=2, limit=10 → texto [data-test=pagination-range] = 'Mostrando 11–20 de 42'", () => {
    const wrapper = mountTable({ total: 42, page: 2, limit: 10 });

    const rangeEl = wrapper.find("[data-test='pagination-range']");
    expect(rangeEl.exists()).toBe(true);
    expect(rangeEl.text()).toBe("Mostrando 11–20 de 42");
  });

  it("AC-9: total=0, page=1, limit=10 → texto 'Mostrando 0 de 0' e botões Anterior e Próximo disabled", () => {
    const wrapper = mountTable({ total: 0, page: 1, limit: 10 });

    const rangeEl = wrapper.find("[data-test='pagination-range']");
    expect(rangeEl.exists()).toBe(true);
    expect(rangeEl.text()).toBe("Mostrando 0 de 0");

    const btnPrev = wrapper.find("[data-test='btn-prev']");
    const btnNext = wrapper.find("[data-test='btn-next']");
    expect(btnPrev.exists()).toBe(true);
    expect(btnNext.exists()).toBe(true);
    expect(btnPrev.attributes("disabled")).toBeDefined();
    expect(btnNext.attributes("disabled")).toBeDefined();
  });

  it("AC-10: page=1 → botão [data-test=btn-prev] tem atributo disabled", () => {
    const wrapper = mountTable({ total: 42, page: 1, limit: 10 });

    const btnPrev = wrapper.find("[data-test='btn-prev']");
    expect(btnPrev.exists()).toBe(true);
    expect(btnPrev.attributes("disabled")).toBeDefined();
  });

  it("AC-11: total=42, page=5, limit=10 (última página) → botão [data-test=btn-next] tem atributo disabled", () => {
    const wrapper = mountTable({ total: 42, page: 5, limit: 10 });

    const btnNext = wrapper.find("[data-test='btn-next']");
    expect(btnNext.exists()).toBe(true);
    expect(btnNext.attributes("disabled")).toBeDefined();
  });

  it("AC-12: page=2 → clicar [data-test=btn-prev] emite update:page com valor 1", async () => {
    const wrapper = mountTable({ total: 42, page: 2, limit: 10 });

    const btnPrev = wrapper.find("[data-test='btn-prev']");
    expect(btnPrev.exists()).toBe(true);
    await btnPrev.trigger("click");

    const emitted = wrapper.emitted("update:page");
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual([1]);
  });

  it("AC-13: total=42, page=1, limit=10 → clicar [data-test=btn-next] emite update:page com valor 2", async () => {
    const wrapper = mountTable({ total: 42, page: 1, limit: 10 });

    const btnNext = wrapper.find("[data-test='btn-next']");
    expect(btnNext.exists()).toBe(true);
    await btnNext.trigger("click");

    const emitted = wrapper.emitted("update:page");
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual([2]);
  });

  it("AC-14: limit=10 → selecionar 100 em [data-test=select-limit] emite update:limit com valor numérico 100", async () => {
    const wrapper = mountTable({ total: 42, page: 1, limit: 10 });

    const selectEl = wrapper.find("[data-test='select-limit']");
    expect(selectEl.exists()).toBe(true);

    await selectEl.setValue("100");

    const emitted = wrapper.emitted("update:limit");
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual([100]);
  });
});
