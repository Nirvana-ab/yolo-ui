<template>
<section class="view-stack">
  <div class="chart-grid">
    <div class="chart-card">
      <div class="card-title">
        <span>Type Distribution</span>
        <strong>目标类型分布</strong>
      </div>
      <div class="bar-chart">
        <div v-for="item in classDistribution" :key="item.name" class="bar-row">
          <span>{{ item.name }}</span>
          <div><i :style="{ width: `${item.percent}%` }"></i></div>
          <strong>{{ item.count }}</strong>
        </div>
      </div>
    </div>

    <div class="chart-card">
      <div class="card-title">
        <span>Traffic Timeline</span>
        <strong>车流量时间变化</strong>
      </div>
      <svg class="line-chart" viewBox="0 0 320 150" preserveAspectRatio="none">
        <polyline :points="flowSeriesPoints" />
        <circle v-for="point in flowSeries" :key="`${point.frame}-${point.count}`" :cx="point.x" :cy="point.y" r="3" />
      </svg>
      <p class="chart-note">
        {{ flowHistory.length ? `当前播放帧：${frameCount}，当前画面车辆数：${totalCount}` : '上传视频后，这里会按播放进度记录整幅画面的车辆数量变化。' }}
      </p>
    </div>

    <div class="chart-card">
      <div class="card-title">
        <span>Speed Histogram</span>
        <strong>速度分布</strong>
      </div>
      <div class="histogram">
        <div v-for="bucket in speedBuckets" :key="bucket.label">
          <i :style="{ height: `${bucket.percent}%` }"></i>
          <span>{{ bucket.label }}</span>
        </div>
      </div>
    </div>

    <div class="chart-card">
      <div class="card-title">
        <span>Area Distribution</span>
        <strong>区域目标分布</strong>
      </div>
      <div class="area-bars">
        <div v-for="region in regionStats" :key="region.name">
          <span>{{ region.name }}</span>
          <i :style="{ height: `${region.percent}%` }"></i>
          <strong>{{ region.count }}</strong>
        </div>
      </div>
    </div>
  </div>
</section>
</template>

<script setup>
defineProps({
  classDistribution: {
    type: Array,
    default: () => [],
  },
  flowSeries: {
    type: Array,
    default: () => [],
  },
  flowSeriesPoints: {
    type: String,
    default: '',
  },
  flowHistory: {
    type: Array,
    default: () => [],
  },
  frameCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
  speedBuckets: {
    type: Array,
    default: () => [],
  },
  regionStats: {
    type: Array,
    default: () => [],
  },
})
</script>
