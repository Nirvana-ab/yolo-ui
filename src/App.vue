<template>
  <div class="traffic-page" :class="isDarkTheme ? 'theme-dark' : 'theme-light'">
    <div class="beam beam-a"></div>
    <div class="beam beam-b"></div>
    <div class="beam beam-c"></div>

    <div class="shell">
      <AppWindowBar :dark="isDarkTheme" @update:dark="isDarkTheme = $event" />

      <TrafficHero
        :total-count="tableData.length"
        :pedestrian-count="pedestrianCount"
        :vehicle-count="vehicleCount"
        :average-speed-text="averageSpeedText"
      />

      <main class="workspace">
        <ControlPanel
          :selected-model="selectedModel"
          :class-mode="classMode"
          :conf-threshold="confThreshold"
          :meters-per-pixel="metersPerPixel"
          :loading="loading"
          @update:selected-model="selectedModel = $event"
          @update:class-mode="classMode = $event"
          @update:conf-threshold="confThreshold = $event"
          @update:meters-per-pixel="metersPerPixel = $event"
          @upload-media="uploadMedia"
          @re-analyze="reAnalyze"
        />

        <section class="main-panel">
          <ViewNavigation :views="views" :active-view="activeView" @update:active-view="activeView = $event" />
          <PanelTopbar :active-view-meta="activeViewMeta" />

          <div class="view-holder">
            <MonitorView
              v-show="activeView === 'monitor'"
              :show-detection-overlay="showDetectionOverlay"
              :media-url="mediaUrl"
              :media-type="mediaType"
              :canvas-style="canvasStyle"
              :displayed-detections="displayedDetections"
              :target-colors="TARGET_COLORS"
              :flow-insight="flowInsight"
              :region-stats="regionStats"
              :speed-line-a="speedLineA"
              :speed-line-b="speedLineB"
              :is-pedestrian="isPedestrian"
              :is-vehicle="isVehicle"
              :get-detection-key="getDetectionKey"
              :get-center-style="getCenterStyle"
              :get-box-style="getBoxStyle"
              @update:show-detection-overlay="showDetectionOverlay = $event"
              @video-time-update="handleVideoTimeUpdate"
              @video-play="handleVideoPlay"
              @video-ended="handleVideoEnded"
            />

            <AnalyticsView
              v-show="activeView === 'analytics'"
              :class-distribution="classDistribution"
              :flow-series="flowSeries"
              :flow-series-points="flowSeriesPoints"
              :flow-history="flowHistory"
              :frame-count="flowFrameCount"
              :total-count="vehicleFlowCount"
              :speed-buckets="speedBuckets"
              :region-stats="regionStats"
            />

            <DataTablesView
              v-show="activeView === 'tables'"
              :table-data="tableData"
              :speed-records="speedRecords"
              :region-stats="regionStats"
              :get-target-label="getTargetLabel"
              :format-bbox="formatBbox"
            />

            <CalibrationView
              v-show="activeView === 'calibration'"
              :speed-line-a="speedLineA"
              :speed-line-b="speedLineB"
              :line-distance-meters="lineDistanceMeters"
              :meters-per-pixel="metersPerPixel"
              @update:speed-line-a="speedLineA = $event"
              @update:speed-line-b="speedLineB = $event"
              @update:line-distance-meters="lineDistanceMeters = $event"
              @update:meters-per-pixel="metersPerPixel = $event"
            />

            <HeatmapView v-show="activeView === 'heatmap'" :heatmap-points="heatmapPoints" />

            <RoiDemoView v-show="activeView === 'roi-demo'" />

          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import AppWindowBar from './components/AppWindowBar.vue';
import TrafficHero from './components/TrafficHero.vue';
import ControlPanel from './components/ControlPanel.vue';
import ViewNavigation from './components/ViewNavigation.vue';
import PanelTopbar from './components/PanelTopbar.vue';
import MonitorView from './components/views/MonitorView.vue';
import AnalyticsView from './components/views/AnalyticsView.vue';
import DataTablesView from './components/views/DataTablesView.vue';
import CalibrationView from './components/views/CalibrationView.vue';
import HeatmapView from './components/views/HeatmapView.vue';
import RoiDemoView from './components/views/RoiDemoView.vue';
import { TARGET_COLORS, views } from './constants/traffic';
import { useTrafficAnalysis } from './composables/useTrafficAnalysis';
import { useTrafficMedia } from './composables/useTrafficMedia';

const activeView = ref('monitor');
const isDarkTheme = ref(false);
const showDetectionOverlay = ref(true);
const mediaUrl = ref('');
const videoStreamSessionId = ref('');
const mediaType = ref('image');
const tableData = ref([]);
const detectionFrameCache = ref({});
const flowHistory = ref([]);
const loading = ref(false);
const videoDetecting = ref(false);
const confThreshold = ref(0.25);
const currentImgWidth = ref(1);
const currentImgHeight = ref(1);
const currentFile = ref(null);
const frameCount = ref(0);
const fps = ref(0);
const currentVideoTime = ref(0);
const videoEnded = ref(false);
const streamStatsTimer = ref(null);
const lastReceivedFrame = ref(0);
const selectedModel = ref('mainTask_latest.onnx');
const classMode = ref('traffic');
const metersPerPixel = ref(0.03);
const speedLineA = ref(38);
const speedLineB = ref(68);
const lineDistanceMeters = ref(28);

const trafficState = {
  activeView,
  showDetectionOverlay,
  mediaUrl,
  videoStreamSessionId,
  mediaType,
  tableData,
  detectionFrameCache,
  flowHistory,
  loading,
  videoDetecting,
  confThreshold,
  currentImgWidth,
  currentImgHeight,
  currentFile,
  frameCount,
  fps,
  currentVideoTime,
  videoEnded,
  streamStatsTimer,
  lastReceivedFrame,
  selectedModel,
  classMode,
  metersPerPixel,
  speedLineA,
  speedLineB,
  lineDistanceMeters,
};

const activeViewMeta = computed(() => views.find((view) => view.key === activeView.value) || views[0]);
const canvasStyle = computed(() => {
  const width = currentImgWidth.value || 1;
  const height = currentImgHeight.value || 1;
  const ratio = width / height;
  const maxCanvasHeight = 680;
  const maxCanvasWidth = Math.round(Math.max(360, Math.min(1280, ratio * maxCanvasHeight)));
  return {
    aspectRatio: `${width} / ${height}`,
    maxWidth: `${maxCanvasWidth}px`,
  };
});

const {
  displayedDetections,
  flowFrameCount,
  pedestrianCount,
  vehicleCount,
  vehicleFlowCount,
  flowInsight,
  classDistribution,
  regionStats,
  speedRecords,
  averageSpeedText,
  speedBuckets,
  flowSeries,
  flowSeriesPoints,
  heatmapPoints,
  isPedestrian,
  isVehicle,
  getTargetLabel,
  formatBbox,
  recordFlowPoint,
  withDisplayNames,
  getDetectionKey,
  getBoxStyle,
  getCenterStyle,
} = useTrafficAnalysis(trafficState);

const {
  uploadMedia,
  reAnalyze,
  handleVideoTimeUpdate,
  handleVideoPlay,
  handleVideoEnded,
} = useTrafficMedia(trafficState, { recordFlowPoint, withDisplayNames });
</script>

<style>
:root {
  --bg: #080a0d;
  --panel: rgba(24, 27, 31, 0.76);
  --panel-strong: rgba(37, 42, 49, 0.86);
  --border: rgba(218, 225, 235, 0.16);
  --text: #f5f7fb;
  --muted: rgba(226, 232, 240, 0.64);
  --orange: #ff8a2a;
  --blue: #6bb6ff;
  --amber: #f5c451;
  --steel: #aeb6c4;
}

body {
  margin: 0;
  min-width: 320px;
  background: #050607;
}

.traffic-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  color: var(--text);
  background:
    linear-gradient(135deg, rgba(5, 6, 8, 0.98), rgba(20, 24, 29, 0.96)),
    radial-gradient(circle at 92% 18%, rgba(107, 182, 255, 0.16), transparent 30%),
    radial-gradient(circle at 72% 95%, rgba(255, 138, 42, 0.12), transparent 28%);
  font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
}

.traffic-page::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.22;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 36px 36px;
}

.beam {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 999px;
  filter: blur(96px);
  opacity: 0.32;
}

.beam-a {
  top: -150px;
  left: -110px;
  background: rgba(174, 182, 196, 0.26);
}

.beam-b {
  right: -150px;
  top: 120px;
  background: rgba(107, 182, 255, 0.22);
}

.beam-c {
  left: 45%;
  bottom: -180px;
  background: rgba(255, 138, 42, 0.18);
}

.shell {
  position: relative;
  z-index: 1;
  width: min(1480px, calc(100% - 48px));
  margin: 0 auto;
  padding: 42px 0;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(430px, 0.55fr);
  gap: 28px;
  align-items: end;
  margin-bottom: 26px;
}

.eyebrow,
.section-kicker {
  margin: 0 0 10px;
  color: var(--orange);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.hero h1,
.panel-heading h2,
.panel-topbar h2 {
  margin: 0;
  letter-spacing: -0.05em;
}

.hero h1 {
  max-width: 900px;
  font-size: clamp(40px, 5vw, 72px);
  line-height: 0.98;
  background: linear-gradient(115deg, #fff 0%, #d9dde7 38%, #8f9aaa 72%, #fff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.subtitle {
  max-width: 840px;
  margin: 20px 0 0;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.75;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(100px, 1fr));
  gap: 12px;
}

.metric-card,
.control-panel,
.main-panel,
.video-card,
.stats-card,
.chart-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.035)),
    linear-gradient(180deg, rgba(46, 52, 60, 0.72), rgba(12, 15, 19, 0.72));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(0, 0, 0, 0.5),
    0 26px 80px rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(22px);
}

.metric-card {
  border-radius: 22px;
  padding: 16px;
}

.metric-card.active {
  border-color: rgba(255, 138, 42, 0.58);
}

.metric-card span {
  display: block;
  color: var(--muted);
  font-size: 13px;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  color: #fff;
  font-size: 34px;
  line-height: 1;
}

.workspace {
  display: grid;
  grid-template-columns: 390px minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

.control-panel,
.main-panel {
  border-radius: 30px;
  padding: 24px;
}

.control-panel {
  position: sticky;
  top: 24px;
}

.panel-heading p {
  margin: 12px 0 22px;
  color: var(--muted);
  line-height: 1.7;
}

.traffic-upload .el-upload,
.full-control {
  width: 100%;
}

.traffic-upload .el-upload-dragger {
  width: 100%;
  min-height: 190px;
  border: 1px dashed rgba(255, 138, 42, 0.42);
  border-radius: 26px;
  background:
    radial-gradient(circle at 50% 30%, rgba(107, 182, 255, 0.14), transparent 42%),
    rgba(9, 12, 16, 0.78);
}

.upload-content {
  min-height: 165px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text);
}

.upload-content span,
.form-grid label span {
  color: var(--muted);
  font-size: 13px;
}

.upload-icon {
  color: var(--orange);
  font-size: 42px;
}

.form-grid {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.form-grid label {
  display: grid;
  gap: 8px;
}

.view-nav {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.view-nav button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.view-nav button.active {
  border-color: rgba(255, 138, 42, 0.62);
  background: rgba(255, 138, 42, 0.12);
}

.view-nav span {
  color: var(--orange);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.panel-topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.status-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: var(--muted);
  font-size: 12px;
}

.status-pills span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
}

.legend-box,
.legend-dot {
  display: inline-block;
}

.legend-box {
  width: 14px;
  height: 10px;
  border: 2px solid var(--orange);
  border-radius: 4px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--amber);
}

.view-stack {
  display: grid;
  gap: 18px;
}

.view-holder {
  position: relative;
}

.monitor-card {
  padding: 24px;
}

.video-card,
.chart-card,
.stats-card {
  border-radius: 24px;
  padding: 18px;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.viewer-title {
  align-items: flex-start;
}

.viewer-title > div:first-child {
  display: grid;
  gap: 4px;
}

.card-title span {
  color: var(--orange);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.overlay-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(218, 225, 235, 0.14);
  border-radius: 999px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.07);
  white-space: nowrap;
}

.overlay-switch span {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0;
  text-transform: none;
}

.overlay-switch span.active {
  color: var(--text);
}

.media-stage,
.calibration-preview {
  position: relative;
  min-height: 430px;
  overflow: hidden;
  border: 1px solid rgba(218, 225, 235, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(10, 12, 15, 0.98), rgba(21, 27, 34, 0.96)),
    radial-gradient(circle at 52% 48%, rgba(107, 182, 255, 0.1), transparent 35%);
}

.unified-stage {
  min-height: 620px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.processed-stage::after,
.calibration-preview::after {
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

.empty-stage {
  min-height: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  text-align: center;
}

.base-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.vision-canvas {
  position: relative;
  z-index: 1;
  width: 100%;
  overflow: hidden;
  border-radius: 20px;
  background: rgba(2, 6, 12, 0.92);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 24px 55px rgba(15, 23, 42, 0.16);
}

.target-center-dot {
  position: absolute;
  z-index: 9;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: left 0.06s linear, top 0.06s linear, opacity 0.12s ease;
}

.speed-line-overlay {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 7;
  transform: translateY(-50%);
  border-top: 2px dashed rgba(255, 138, 42, 0.92);
  color: rgba(255, 255, 255, 0.94);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  padding: 3px 8px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.speed-line-overlay.line-b {
  border-top-color: rgba(107, 182, 255, 0.92);
  text-align: right;
}

.bounding-box {
  position: absolute;
  z-index: 8;
  border: 2px solid rgba(255, 138, 42, 0.9);
  border-radius: 10px;
  background: rgba(255, 138, 42, 0.08);
  box-shadow: 0 0 20px rgba(255, 138, 42, 0.26);
  transition:
    left 0.06s linear,
    top 0.06s linear,
    width 0.06s linear,
    height 0.06s linear,
    opacity 0.18s ease,
    transform 0.18s ease,
    border-color 0.18s ease;
  will-change: left, top, width, height;
}

.bounding-box.pedestrian {
  border-color: rgba(107, 182, 255, 0.92);
  background: rgba(107, 182, 255, 0.09);
}

.box-label {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translate(-50%, 4px);
  max-width: 190px;
  padding: 5px 9px;
  border-radius: 999px;
  opacity: 0;
  color: #120b05;
  background: var(--orange);
  font-size: 12px;
  font-weight: 800;
  pointer-events: none;
  white-space: nowrap;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.pedestrian .box-label {
  color: #06111f;
  background: var(--blue);
}

.bounding-box.is-hovered {
  z-index: 20;
  transform: scale(1.025);
}

.bounding-box.is-hovered .box-label {
  opacity: 1;
  transform: translate(-50%, 0);
}

.bounding-box.is-dimmed {
  opacity: 0.18;
}

.insight-grid,
.chart-grid,
.calibration-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.flow-text {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.region-mini {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.region-mini span {
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
}

.bar-chart,
.area-bars,
.histogram {
  min-height: 210px;
}

.bar-row {
  display: grid;
  grid-template-columns: 70px 1fr 38px;
  gap: 10px;
  align-items: center;
  margin: 14px 0;
}

.bar-row span,
.bar-row strong,
.area-bars span,
.area-bars strong,
.histogram span {
  color: var(--muted);
  font-size: 12px;
}

.bar-row div {
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.bar-row i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--orange), var(--blue));
}

.line-chart {
  width: 100%;
  height: 230px;
}

.line-chart polyline {
  fill: none;
  stroke: var(--blue);
  stroke-width: 4;
  filter: drop-shadow(0 0 10px rgba(107, 182, 255, 0.45));
}

.line-chart circle {
  fill: var(--orange);
}

.chart-note {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.histogram,
.area-bars {
  display: flex;
  align-items: end;
  justify-content: space-around;
  gap: 14px;
}

.histogram div,
.area-bars div {
  height: 210px;
  display: grid;
  align-items: end;
  justify-items: center;
  gap: 8px;
}

.histogram i,
.area-bars i {
  width: 38px;
  min-height: 8px;
  border-radius: 12px 12px 4px 4px;
  background: linear-gradient(180deg, var(--orange), rgba(107, 182, 255, 0.45));
}

.traffic-table {
  overflow: hidden;
  border-radius: 20px;
  --el-table-bg-color: rgba(12, 15, 19, 0.68);
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.075);
  --el-table-border-color: rgba(255, 255, 255, 0.08);
  --el-table-text-color: var(--text);
  --el-table-header-text-color: var(--muted);
  --el-table-row-hover-bg-color: rgba(255, 138, 42, 0.1);
}

.data-tabs {
  --el-color-primary: var(--orange);
  --el-text-color-primary: var(--text);
  --el-text-color-regular: var(--muted);
  --el-border-color-light: rgba(255, 255, 255, 0.1);
}

.calibration-values {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.calibration-guide {
  display: grid;
  gap: 8px;
  margin: 14px 0 8px;
}

.calibration-guide span {
  padding: 10px 12px;
  border: 1px solid rgba(218, 225, 235, 0.14);
  border-radius: 14px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.06);
}

.calibration-values span {
  padding: 12px 14px;
  border-radius: 14px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.07);
}

.speed-line-preview {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  color: var(--orange);
  background: var(--orange);
  box-shadow: 0 0 18px rgba(255, 138, 42, 0.5);
}

.line-b-preview {
  color: var(--blue);
  background: var(--blue);
  box-shadow: 0 0 18px rgba(107, 182, 255, 0.5);
}

@media (max-width: 1180px) {
  .hero,
  .workspace,
  .chart-grid,
  .calibration-grid,
  .insight-grid {
    grid-template-columns: 1fr;
  }

  .control-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .shell {
    width: min(100% - 24px, 1480px);
    padding: 24px 0;
  }

  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .control-panel,
  .main-panel {
    padding: 18px;
    border-radius: 24px;
  }
}

/* Desktop app theme layer: adjustable light/dark background */
.traffic-page.theme-light {
  --bg: #eef1f5;
  --panel: rgba(255, 255, 255, 0.82);
  --panel-strong: rgba(255, 255, 255, 0.94);
  --border: rgba(132, 143, 160, 0.24);
  --text: #273142;
  --muted: rgba(39, 49, 66, 0.64);
  --orange: #0f9ee8;
  --blue: #8d7cf6;
  --amber: #58b96d;
  color: var(--text);
  background:
    radial-gradient(circle at 28% 0%, rgba(255, 255, 255, 0.95), transparent 36%),
    linear-gradient(135deg, #f7f8fb, #e7ebf1 48%, #f4f6f9);
}

.traffic-page.theme-dark {
  --bg: #080a0d;
  --panel: rgba(24, 27, 31, 0.76);
  --panel-strong: rgba(37, 42, 49, 0.86);
  --border: rgba(218, 225, 235, 0.16);
  --text: #f5f7fb;
  --muted: rgba(226, 232, 240, 0.64);
  --orange: #ff8a2a;
  --blue: #6bb6ff;
  --amber: #f5c451;
}

.traffic-page.theme-light::before {
  opacity: 0.5;
  background-image:
    linear-gradient(rgba(100, 116, 139, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(100, 116, 139, 0.08) 1px, transparent 1px);
}

.theme-light .beam {
  opacity: 0.22;
}

.theme-light .beam-a {
  background: rgba(15, 158, 232, 0.25);
}

.theme-light .beam-b {
  background: rgba(141, 124, 246, 0.22);
}

.theme-light .beam-c {
  background: rgba(88, 185, 109, 0.2);
}

.window-bar {
  height: 38px;
  display: grid;
  grid-template-columns: 180px 1fr 220px;
  align-items: center;
  margin-bottom: 26px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 18px;
  color: var(--muted);
  background: var(--panel-strong);
  box-shadow: 0 18px 50px rgba(31, 41, 55, 0.12);
}

.window-bar strong {
  justify-self: center;
  color: var(--text);
  font-size: 15px;
}

.window-dots {
  display: flex;
  gap: 10px;
}

.window-dots i {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #ff5f57;
}

.window-dots i:nth-child(2) {
  background: #ffbd2e;
}

.window-dots i:nth-child(3) {
  background: #28c840;
}

.theme-switch {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}

.theme-light .hero h1 {
  background: linear-gradient(115deg, #1f2937 0%, #4b5563 45%, #111827 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.theme-light .eyebrow,
.theme-light .section-kicker {
  color: #0f9ee8;
}

.theme-light .metric-card,
.theme-light .control-panel,
.theme-light .main-panel,
.theme-light .video-card,
.theme-light .stats-card,
.theme-light .chart-card {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(243, 246, 250, 0.86)),
    var(--panel);
  border-color: var(--border);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 24px 70px rgba(31, 41, 55, 0.12);
}

.theme-light .metric-card.active,
.theme-light .view-nav button.active {
  border-color: rgba(15, 158, 232, 0.45);
  background: rgba(15, 158, 232, 0.08);
}

.theme-light .metric-card span {
  color: rgba(51, 65, 85, 0.68);
}

.theme-light .metric-card strong {
  color: #111827;
}

.theme-light .traffic-upload .el-upload-dragger,
.theme-light .media-stage,
.theme-light .calibration-preview {
  border-color: rgba(132, 143, 160, 0.24);
  background:
    linear-gradient(135deg, rgba(250, 252, 255, 0.95), rgba(234, 239, 247, 0.86)),
    radial-gradient(circle at 50% 35%, rgba(15, 158, 232, 0.08), transparent 42%);
}

.theme-light .processed-stage::after,
.theme-light .calibration-preview::after {
  background:
    linear-gradient(90deg, transparent 0 48%, rgba(15, 158, 232, 0.14) 49%, transparent 51% 100%),
    linear-gradient(180deg, transparent 0 48%, rgba(141, 124, 246, 0.12) 49%, transparent 51% 100%),
    repeating-linear-gradient(0deg, transparent 0 18px, rgba(100, 116, 139, 0.055) 19px, transparent 20px);
}

.theme-light .view-nav button,
.theme-light .status-pills span,
.theme-light .region-mini span,
.theme-light .calibration-values span {
  color: var(--text);
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(132, 143, 160, 0.18);
}

.theme-light .traffic-table {
  --el-table-bg-color: rgba(255, 255, 255, 0.86);
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(243, 246, 250, 0.92);
  --el-table-border-color: rgba(132, 143, 160, 0.18);
  --el-table-text-color: var(--text);
  --el-table-header-text-color: var(--muted);
  --el-table-row-hover-bg-color: rgba(15, 158, 232, 0.08);
}

.theme-light .el-select__wrapper {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(132, 143, 160, 0.2) inset;
}

.workspace {
  grid-template-columns: 360px minmax(0, 1fr);
}

.control-panel {
  padding: 20px;
}

.control-panel .panel-heading p {
  margin-bottom: 16px;
}

.traffic-upload .el-upload-dragger {
  min-height: 132px;
  border-radius: 22px;
}

.upload-content {
  min-height: 108px;
  gap: 6px;
}

.upload-icon {
  font-size: 30px;
}

.form-grid {
  gap: 10px;
  margin-top: 14px;
}

.form-grid label {
  gap: 5px;
}

.view-nav {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.view-nav button {
  display: grid;
  justify-items: start;
  min-height: 58px;
  padding: 10px 12px;
  border-radius: 16px;
}

.view-nav button strong {
  font-size: 14px;
}

.hero {
  grid-template-columns: minmax(0, 1.3fr) minmax(420px, 0.7fr);
}

.hero h1 {
  font-size: clamp(38px, 4.4vw, 64px);
}

.subtitle {
  margin-top: 12px;
}

.media-stage,
.calibration-preview {
  min-height: 380px;
}

@media (max-width: 1180px) {
  .window-bar {
    grid-template-columns: 1fr;
    height: auto;
    gap: 8px;
    padding: 12px;
  }

  .window-dots,
  .theme-switch,
  .window-bar strong {
    justify-self: center;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .shell {
    width: min(100% - 20px, 1480px);
    padding: 16px 0;
  }

  .window-bar {
    margin-bottom: 18px;
    border-radius: 16px;
  }

  .window-bar strong {
    max-width: 100%;
    font-size: 13px;
    white-space: nowrap;
  }

  .theme-switch {
    font-size: 11px;
  }

  .hero {
    gap: 16px;
    margin-bottom: 18px;
  }

  .eyebrow,
  .section-kicker {
    font-size: 11px;
    letter-spacing: 0.12em;
    word-break: normal;
  }

  .hero h1 {
    font-size: clamp(32px, 13vw, 42px);
    line-height: 1.08;
    word-break: keep-all;
  }

  .subtitle {
    font-size: 14px;
    line-height: 1.65;
    word-break: normal;
  }

  .control-panel {
    padding: 16px;
  }

  .control-panel .panel-heading p {
    display: none;
  }

  .traffic-upload .el-upload-dragger {
    min-height: 104px;
  }

  .upload-content {
    min-height: 82px;
  }

  .form-grid {
    gap: 8px;
  }

  .view-nav button {
    min-height: 52px;
    padding: 9px 10px;
  }

  .view-nav button strong {
    font-size: 13px;
  }

  .panel-topbar {
    display: grid;
  }

  .status-pills {
    justify-content: flex-start;
  }

  .viewer-title {
    display: grid;
  }

  .overlay-switch {
    justify-self: start;
  }

  .unified-stage {
    min-height: 420px;
    padding: 10px;
  }
}

/* Right-side function rail: the left panel stays focused on input, the main panel owns navigation. */
.main-panel > .view-nav {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 20px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.055);
}

.main-panel > .view-nav button {
  min-height: 72px;
  padding: 10px 9px;
  border-radius: 14px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025)),
    rgba(255, 255, 255, 0.04);
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.main-panel > .view-nav button:hover {
  transform: translateY(-2px);
  border-color: rgba(107, 182, 255, 0.42);
}

.main-panel > .view-nav button.active {
  border-color: rgba(15, 158, 232, 0.55);
  background:
    linear-gradient(145deg, rgba(15, 158, 232, 0.18), rgba(141, 124, 246, 0.09)),
    rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28), 0 18px 38px rgba(15, 158, 232, 0.13);
}

.main-panel > .view-nav button strong,
.main-panel > .view-nav button em {
  display: block;
}

.main-panel > .view-nav button em {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
  font-style: normal;
  line-height: 1.25;
}

.main-panel > .view-nav button strong {
  font-size: 14px;
  line-height: 1.2;
}

.main-panel > .view-nav button span {
  font-size: 10px;
  letter-spacing: 0.12em;
}

.calibration-settings {
  display: grid;
  align-content: start;
}

.speed-tuner {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.speed-tuner label {
  display: grid;
  gap: 6px;
  padding: 13px 14px 8px;
  border: 1px solid rgba(218, 225, 235, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.055);
}

.speed-tuner label > span {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
}

.speed-tuner strong {
  color: var(--text);
}

.theme-light .main-panel > .view-nav {
  background: rgba(255, 255, 255, 0.66);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.theme-light .main-panel > .view-nav button {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(239, 244, 250, 0.86)),
    rgba(255, 255, 255, 0.78);
  box-shadow: 0 12px 28px rgba(31, 41, 55, 0.06);
}

.theme-light .main-panel > .view-nav button.active {
  background:
    linear-gradient(145deg, rgba(218, 239, 255, 0.95), rgba(238, 235, 255, 0.92)),
    rgba(255, 255, 255, 0.86);
}

.theme-light .overlay-switch {
  border-color: rgba(132, 143, 160, 0.18);
  background: rgba(255, 255, 255, 0.76);
}

.theme-light .speed-tuner label {
  border-color: rgba(132, 143, 160, 0.18);
  background: rgba(255, 255, 255, 0.68);
}

@media (max-width: 1180px) {
  .main-panel > .view-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .main-panel > .view-nav {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 6px;
  }

  .main-panel > .view-nav button {
    min-height: 66px;
  }
}
</style>



