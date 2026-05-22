<script setup lang="ts">
const props = defineProps<{ status: string }>();

interface BadgeStyle {
  bg: string;
  text?: string;
}

const styleMap: Record<string, BadgeStyle> = {
  Running: { bg: "primary" },
  Queued: { bg: "warning", text: "dark" },
  Completed: { bg: "success" },
  Failed: { bg: "danger" },
  Timeout: { bg: "warning", text: "dark" },
};

const style = styleMap[props.status] ?? { bg: "secondary" };
</script>

<template>
  <span
    :class="['badge', `bg-${style.bg}`, style.text ? `text-${style.text}` : '']"
    data-test="status-badge"
    >{{ status }}</span
  >
</template>
