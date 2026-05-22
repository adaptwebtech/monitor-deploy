<script setup lang="ts">
import type { PipelineQueue } from "../types";

defineProps<{ running: PipelineQueue | null }>();
</script>

<template>
  <div
    v-if="running"
    class="alert alert-info d-flex align-items-center gap-2 mb-0"
    data-test="running-indicator"
  >
    <span
      class="spinner-grow spinner-grow-sm text-primary"
      role="status"
    ></span>
    <span>
     <strong>{{ running.app }}-{{ running.environment }}{{ running.currentStep ? `-${running.currentStep}` : "" }}</strong>
      em execução
    </span>
  </div>
</template>
