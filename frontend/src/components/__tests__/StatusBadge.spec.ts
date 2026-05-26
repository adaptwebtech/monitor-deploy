import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatusBadge from "../StatusBadge.vue";

describe("StatusBadge — status rendering", () => {
  // AC-6 (complementar): garante que outros status existentes não são afetados
  it("AC-6: status 'Running' continua renderizando bg-primary (sem regressão)", () => {
    // Arrange
    const wrapper = mount(StatusBadge, {
      props: { status: "Running" },
    });

    // Act
    const badge = wrapper.find('[data-test="status-badge"]');

    // Assert
    expect(badge.classes()).toContain("bg-primary");
    expect(badge.classes()).not.toContain("bg-warning");
  });
});
