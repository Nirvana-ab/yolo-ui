<template>
<section class="view-stack">
  <div class="calibration-grid">
    <div class="chart-card calibration-settings">
      <div class="card-title">
        <span>Dual Speed Lines</span>
        <strong>速度校准配置</strong>
      </div>
      <p class="flow-text">
        按步骤完成标定：先把 A/B 两条线放到道路上的两个参考位置，再输入两线真实距离。目标穿过两条线后会优先使用测速线速度。
      </p>
      <div class="calibration-guide">
        <span>1. 将 Line A 放在目标先经过的位置</span>
        <span>2. 将 Line B 放在目标后经过的位置</span>
        <span>3. 按现场距离调整线间实际距离</span>
      </div>
      <div class="speed-tuner">
        <label>
          <span>测速线 A <strong>{{ speedLineA }}%</strong></span>
          <el-slider v-model="speedLineA" :min="10" :max="85" :step="1" />
        </label>
        <label>
          <span>测速线 B <strong>{{ speedLineB }}%</strong></span>
          <el-slider v-model="speedLineB" :min="15" :max="95" :step="1" />
        </label>
        <label>
          <span>线间实际距离 <strong>{{ lineDistanceMeters }} m</strong></span>
          <el-slider v-model="lineDistanceMeters" :min="5" :max="80" :step="1" />
        </label>
        <label>
          <span>像素标定 <strong>{{ metersPerPixel.toFixed(3) }} m/px</strong></span>
          <el-slider v-model="metersPerPixel" :min="0.005" :max="0.12" :step="0.005" />
        </label>
      </div>
      <div class="calibration-values">
        <span>测速线速度来自两线真实距离和穿线帧差；未完整穿线的目标使用像素标定兜底。</span>
        <span>像素标定适合短时估算，数值会受视频角度、道路透视和检测框抖动影响。</span>
      </div>
    </div>
    <div class="chart-card calibration-preview">
      <div class="speed-line-preview" :style="{ top: `${speedLineA}%` }">Line A</div>
      <div class="speed-line-preview line-b-preview" :style="{ top: `${speedLineB}%` }">Line B</div>
    </div>
  </div>
</section>
</template>

<script setup>
const speedLineA = defineModel('speedLineA')
const speedLineB = defineModel('speedLineB')
const lineDistanceMeters = defineModel('lineDistanceMeters')
const metersPerPixel = defineModel('metersPerPixel')
</script>
