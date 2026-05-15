<template>
  <section class="view-stack">
    <div class="heatmap-panel">
      <div v-for="point in heatmapPoints" :key="point.id" class="heat-point" :style="point.style"></div>
      <div class="heatmap-empty" v-if="heatmapPoints.length === 0">
        <strong>等待热力图数据</strong>
        <span>上传视频或图片后，将基于目标中心位置生成热区分布。</span>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  heatmapPoints: {
    type: Array,
    default: () => [],
  },
})
</script>

<style scoped>
.heatmap-panel {
  position: relative;
  min-height: 620px;
  overflow: hidden;
  border: 1px solid rgba(218, 225, 235, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(10, 12, 15, 0.98), rgba(21, 27, 34, 0.96)),
    radial-gradient(circle at 52% 48%, rgba(107, 182, 255, 0.1), transparent 35%);
}

.heatmap-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent 0 48%, rgba(255, 138, 42, 0.1) 49%, transparent 51% 100%),
    linear-gradient(180deg, transparent 0 48%, rgba(107, 182, 255, 0.09) 49%, transparent 51% 100%),
    repeating-linear-gradient(0deg, transparent 0 18px, rgba(255, 255, 255, 0.025) 19px, transparent 20px);
}

.heat-point {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  filter: blur(5px);
  opacity: 0.86;
  pointer-events: none;
}

.heatmap-empty {
  position: relative;
  z-index: 1;
  min-height: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  text-align: center;
}

:global(.theme-light) .heatmap-panel {
  border-color: rgba(132, 143, 160, 0.24);
  background:
    linear-gradient(135deg, rgba(250, 252, 255, 0.95), rgba(234, 239, 247, 0.86)),
    radial-gradient(circle at 50% 35%, rgba(15, 158, 232, 0.08), transparent 42%);
}

:global(.theme-light) .heatmap-panel::after {
  background:
    linear-gradient(90deg, transparent 0 48%, rgba(15, 158, 232, 0.14) 49%, transparent 51% 100%),
    linear-gradient(180deg, transparent 0 48%, rgba(141, 124, 246, 0.12) 49%, transparent 51% 100%),
    repeating-linear-gradient(0deg, transparent 0 18px, rgba(100, 116, 139, 0.055) 19px, transparent 20px);
}

@media (max-width: 720px) {
  .heatmap-panel {
    min-height: 420px;
  }
}
</style>
