<template>
<section class="view-stack">
  <div class="video-card monitor-card">
    <div class="card-title viewer-title">
      <div>
        <span>{{ showDetectionOverlay ? 'Processed Feed' : 'Original Feed' }}</span>
        <strong>{{ showDetectionOverlay ? '检测结果画面' : '原始画面' }}</strong>
      </div>
      <div class="overlay-switch">
        <span :class="{ active: !showDetectionOverlay }">原图</span>
        <el-switch v-model="showDetectionOverlay" :disabled="!mediaUrl" />
        <span :class="{ active: showDetectionOverlay }">检测结果</span>
      </div>
    </div>
    <div class="media-stage unified-stage" :class="{ 'processed-stage': showDetectionOverlay }">
      <template v-if="mediaUrl">
        <div class="vision-canvas" :style="canvasStyle">
          <video
            v-if="mediaType === 'video'"
            :src="mediaUrl"
            class="base-image"
            controls
            muted
            playsinline
            @timeupdate="emit('video-time-update', $event)"
            @seeked="emit('video-time-update', $event)"
            @loadedmetadata="emit('video-time-update', $event)"
            @play="emit('video-play')"
            @ended="emit('video-ended', $event)"
          ></video>
          <img v-else-if="mediaType === 'image'" :src="mediaUrl" class="base-image" :alt="showDetectionOverlay ? '检测结果' : '原始画面'" />

          <template v-if="showDetectionOverlay">
            <div class="speed-line-overlay line-a" :style="{ top: `${speedLineA}%` }">Line A</div>
            <div class="speed-line-overlay line-b" :style="{ top: `${speedLineB}%` }">Line B</div>

            <template v-if="mediaType !== 'video'">
              <span
                v-for="(item, index) in displayedDetections"
                :key="`center-${getDetectionKey(item, index)}`"
                class="target-center-dot"
                :style="getCenterStyle(item.bbox, targetColors[index % targetColors.length])"
              ></span>
            </template>

            <div
              v-for="(item, index) in displayedDetections"
              :key="getDetectionKey(item, index)"
              class="bounding-box"
              :class="{
                pedestrian: isPedestrian(item.class_name),
                vehicle: isVehicle(item.class_name),
                'is-hovered': hoveredIndex === index,
                'is-dimmed': hoveredIndex !== null && hoveredIndex !== index
              }"
              :style="getBoxStyle(item.bbox)"
              @mouseenter="hoveredIndex = index"
              @mouseleave="hoveredIndex = null"
            >
              <span class="box-label">
                {{ item.display_name }} · {{ (item.confidence * 100).toFixed(0) }}%
              </span>
            </div>
          </template>
        </div>
      </template>
      <div v-else class="empty-stage">
        <strong>等待输入监控视频或图片</strong>
        <span>上传后可在这里切换查看原图和检测结果</span>
      </div>
    </div>
  </div>

  <div class="insight-grid">
    <div class="stats-card">
      <span class="section-kicker">Detection</span>
      <p class="flow-text">{{ flowInsight }}</p>
    </div>
    <div class="stats-card">
      <span class="section-kicker">Region</span>
      <div class="region-mini">
        <span v-for="region in regionStats" :key="region.name">
          {{ region.name }} <strong>{{ region.count }}</strong>
        </span>
      </div>
    </div>
  </div>
</section>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  mediaUrl: {
    type: String,
    default: '',
  },
  mediaType: {
    type: String,
    default: 'image',
  },
  canvasStyle: {
    type: Object,
    default: () => ({}),
  },
  displayedDetections: {
    type: Array,
    default: () => [],
  },
  targetColors: {
    type: Array,
    default: () => [],
  },
  flowInsight: {
    type: String,
    default: '',
  },
  regionStats: {
    type: Array,
    default: () => [],
  },
  speedLineA: {
    type: Number,
    default: 38,
  },
  speedLineB: {
    type: Number,
    default: 68,
  },
  isPedestrian: {
    type: Function,
    required: true,
  },
  isVehicle: {
    type: Function,
    required: true,
  },
  getDetectionKey: {
    type: Function,
    required: true,
  },
  getCenterStyle: {
    type: Function,
    required: true,
  },
  getBoxStyle: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['video-time-update', 'video-play', 'video-ended'])
const showDetectionOverlay = defineModel('showDetectionOverlay')
const hoveredIndex = ref(null)
</script>
