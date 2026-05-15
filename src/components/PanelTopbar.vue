<template>
<div class="panel-topbar">
  <div>
    <span class="section-kicker">{{ activeViewMeta.kicker }}</span>
    <h2>{{ activeViewMeta.label }}</h2>
  </div>
  <div class="status-pills">
    <span><i class="legend-box"></i>位置框</span>
    <span><i class="legend-dot"></i>目标中心</span>
  </div>
</div>
</template>

<script setup>
defineProps({
  activeViewMeta: {
    type: Object,
    required: true,
  },
})
</script>
