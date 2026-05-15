<template>
<nav class="view-nav" aria-label="功能切换">
  <button
    v-for="view in views"
    :key="view.key"
    :class="{ active: activeView === view.key }"
    @click="activeView = view.key"
  >
    <span>{{ view.kicker }}</span>
    <strong>{{ view.label }}</strong>
    <em>{{ view.hint }}</em>
  </button>
</nav>
</template>

<script setup>
defineProps({
  views: {
    type: Array,
    default: () => [],
  },
})

const activeView = defineModel('activeView')
</script>
