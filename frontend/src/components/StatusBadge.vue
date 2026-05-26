<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ status: string }>();

const styleMap: Record<string, string> = {
  Running: "bg-primary",
  Queued: "bg-warning text-dark",
  Completed: "bg-success",
  Failed: "bg-danger",
};

const classes = computed(() => {
  return styleMap[props.status] ?? "bg-secondary";
});
</script>

<template>
  <span :class="['badge', classes]" data-test="status-badge">
    {{ status }}
  </span>
</template>
