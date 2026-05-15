<template>
<header class="hero">
  <div>
    <p class="eyebrow">YOLOv8 Traffic Intelligence</p>
    <h1>交通安全智能分析平台</h1>
    <p class="subtitle">
      面向监控视频的行人、车辆检测系统，支持位置框、计数、测速和区域分布统计。
    </p>
  </div>

  <div class="hero-metrics">
    <div class="metric-card">
      <span>检测目标</span>
      <strong>{{ totalCount }}</strong>
    </div>
    <div class="metric-card active">
      <span>行人数量</span>
      <strong>{{ pedestrianCount }}</strong>
    </div>
    <div class="metric-card">
      <span>车辆数量</span>
      <strong>{{ vehicleCount }}</strong>
    </div>
    <div class="metric-card">
      <span>近景车辆均速</span>
      <strong>{{ averageSpeedText }}</strong>
    </div>
  </div>
</header>
</template>

<script setup>
defineProps({
  totalCount: {
    type: Number,
    default: 0,
  },
  pedestrianCount: {
    type: Number,
    default: 0,
  },
  vehicleCount: {
    type: Number,
    default: 0,
  },
  averageSpeedText: {
    type: String,
    default: '--',
  },
})
</script>
