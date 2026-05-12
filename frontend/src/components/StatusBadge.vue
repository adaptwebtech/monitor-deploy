<script setup lang="ts">
const props = defineProps<{ status: string }>()
const colorMap: Record<string, string> = {
  Running: 'primary',
  Queued: 'warning',
  Completed: 'success',
  Failed: 'danger',
}
const color = colorMap[props.status] ?? 'secondary'
</script>

<template>
  <span :class="`badge bg-${color}`" data-test="status-badge">{{ status }}</span>
</template>
