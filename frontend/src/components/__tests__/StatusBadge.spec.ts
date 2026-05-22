import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { expectTypeOf } from "vitest";
import StatusBadge from "../StatusBadge.vue";
import type { PipelineQueue } from "../../types/index";

describe("StatusBadge — workflow-timeout", () => {
  // AC-6: Dado pipeline com status = 'Timeout', quando StatusBadge renderiza,
  // então exibe badge com classes bg-warning text-dark e texto "Timeout"
  it("AC-6: renderiza badge com bg-warning text-dark quando status é 'Timeout'", () => {
    // Arrange
    const wrapper = mount(StatusBadge, {
      props: { status: "Timeout" },
    });

    // Act
    const badge = wrapper.find('[data-test="status-badge"]');

    // Assert
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain("bg-warning");
    expect(badge.classes()).toContain("text-dark");
    expect(badge.text()).toBe("Timeout");
  });

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

  // AC-7: O tipo status em PipelineQueue inclui 'Timeout' como valor válido.
  // Se 'Timeout' não está no union, expectTypeOf falhará em tempo de compilação/typecheck.
  it("AC-7: tipo PipelineQueue['status'] aceita 'Timeout' como valor válido", () => {
    // Arrange — atribuição que exige 'Timeout' no union de PipelineQueue.status
    const timeoutStatus: PipelineQueue["status"] = "Timeout";

    // Assert — verificação de tipo estático via expectTypeOf
    expectTypeOf(timeoutStatus).toEqualTypeOf<PipelineQueue["status"]>();
    expect(timeoutStatus).toBe("Timeout");
  });
});
