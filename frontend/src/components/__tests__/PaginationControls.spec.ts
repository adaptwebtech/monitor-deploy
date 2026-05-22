import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PaginationControls from "../PaginationControls.vue";

// PaginationControls.vue does not exist yet — all tests must be RED.
// Props: page, totalPages, limit, orderBy
// Emits: pageChange(n), limitChange(n), orderChange(o)
// data-test: pagination-prev, pagination-next, pagination-limit-select,
//            pagination-order-select, pagination-page-info

describe("PaginationControls (AC-14)", () => {
  // ─── AC-14 ───────────────────────────────────────────────────────────────────

  it("AC-14: renders 9 total pages info when total=87 and limit=10", () => {
    const wrapper = mount(PaginationControls, {
      props: {
        page: 1,
        totalPages: 9,
        limit: 10,
        orderBy: "desc",
      },
    });

    const info = wrapper.find("[data-test='pagination-page-info']");
    expect(info.exists()).toBe(true);
    // Should display current page and total pages
    expect(info.text()).toContain("9");
  });

  it("AC-14: prev button is disabled on first page (page=1)", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 1, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const prev = wrapper.find("[data-test='pagination-prev']");
    expect(prev.exists()).toBe(true);
    expect(
      prev.attributes("disabled") !== undefined ||
        (prev.element as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("AC-14: next button is enabled on first page (page=1, totalPages=9)", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 1, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const next = wrapper.find("[data-test='pagination-next']");
    expect(next.exists()).toBe(true);
    expect(
      next.attributes("disabled") === undefined &&
        !(next.element as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("AC-14: next button is disabled on last page (page=9, totalPages=9)", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 9, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const next = wrapper.find("[data-test='pagination-next']");
    expect(next.exists()).toBe(true);
    expect(
      next.attributes("disabled") !== undefined ||
        (next.element as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("AC-14: prev button is enabled on last page (page=9, totalPages=9)", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 9, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const prev = wrapper.find("[data-test='pagination-prev']");
    expect(prev.exists()).toBe(true);
    expect(
      prev.attributes("disabled") === undefined &&
        !(prev.element as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("AC-14: both prev and next enabled on middle page", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 5, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const prev = wrapper.find("[data-test='pagination-prev']");
    const next = wrapper.find("[data-test='pagination-next']");

    expect(
      prev.attributes("disabled") === undefined &&
        !(prev.element as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      next.attributes("disabled") === undefined &&
        !(next.element as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("AC-14: clicking next button emits pageChange with page+1", async () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 3, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    await wrapper.find("[data-test='pagination-next']").trigger("click");

    expect(wrapper.emitted("pageChange")).toBeTruthy();
    expect(wrapper.emitted("pageChange")![0]).toEqual([4]);
  });

  it("AC-14: clicking prev button emits pageChange with page-1", async () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 3, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    await wrapper.find("[data-test='pagination-prev']").trigger("click");

    expect(wrapper.emitted("pageChange")).toBeTruthy();
    expect(wrapper.emitted("pageChange")![0]).toEqual([2]);
  });

  it("AC-14: limit-select renders with current limit value", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 1, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const select = wrapper.find("[data-test='pagination-limit-select']");
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe("10");
  });

  it("AC-14: changing limit-select emits limitChange with new value", async () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 1, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const select = wrapper.find("[data-test='pagination-limit-select']");
    await select.setValue("100");

    expect(wrapper.emitted("limitChange")).toBeTruthy();
    expect(wrapper.emitted("limitChange")![0]).toEqual([100]);
  });

  it("AC-14: order-select renders with current orderBy value", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 1, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const select = wrapper.find("[data-test='pagination-order-select']");
    expect(select.exists()).toBe(true);
    expect((select.element as HTMLSelectElement).value).toBe("desc");
  });

  it("AC-14: changing order-select emits orderChange with new value", async () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 1, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const select = wrapper.find("[data-test='pagination-order-select']");
    await select.setValue("asc");

    expect(wrapper.emitted("orderChange")).toBeTruthy();
    expect(wrapper.emitted("orderChange")![0]).toEqual(["asc"]);
  });

  it("AC-14: page-info shows current page number", () => {
    const wrapper = mount(PaginationControls, {
      props: { page: 5, totalPages: 9, limit: 10, orderBy: "desc" },
    });

    const info = wrapper.find("[data-test='pagination-page-info']");
    expect(info.text()).toContain("5");
  });
});
