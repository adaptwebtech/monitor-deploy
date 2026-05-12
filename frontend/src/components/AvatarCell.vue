<script setup lang="ts">
const props = defineProps<{ url: string | null; name: string }>()
const initials = props.name?.charAt(0)?.toUpperCase() ?? '?'
</script>

<template>
  <div
    style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: #6c757d; color: white; font-size: 14px;"
    data-test="avatar-cell"
  >
    <img
      v-if="url"
      :src="url"
      :alt="name"
      style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
      @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
    />
    <span v-else>{{ initials }}</span>
  </div>
</template>
