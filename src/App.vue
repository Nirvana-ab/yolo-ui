<template>
  <div class="traffic-page">
    <div class="aurora aurora-a"></div>
    <div class="aurora aurora-b"></div>
    <div class="aurora aurora-c"></div>

    <div class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">YOLO Traffic Vision</p>
          <h1>车流路线智能分析台</h1>
          <p class="subtitle">上传道路画面后，系统会识别车辆位置，并在画面上生成车流方向、路线连线和拥堵概览。</p>
        </div>

        <div class="hero-metrics">
          <div class="metric-card">
            <span>检测目标</span>
            <strong>{{ tableData.length }}</strong>
          </div>
          <div class="metric-card active">
            <span>车辆数量</span>
            <strong>{{ vehicleDetections.length }}</strong>
          </div>
          <div class="metric-card">
            <span>车流路线</span>
            <strong>{{ trafficRoutes.length }}</strong>
          </div>
        </div>
      </header>

      <main class="dashboard">
        <section class="control-panel">
          <div class="panel-heading">
            <span class="section-kicker">Input</span>
            <h2>图像上传</h2>
            <p>支持拖拽或点击上传道路图片，检测完成后会自动叠加路线图层。</p>
          </div>

          <el-upload
            class="traffic-upload"
            drag
            action=""
            :http-request="uploadImage"
            :show-file-list="false"
            accept="image/*"
          >
            <div class="upload-content" :class="{ 'is-uploading': loading }">
              <el-icon class="upload-icon"><UploadFilled /></el-icon>
              <strong>{{ loading ? '正在分析画面...' : '拖拽图片到这里' }}</strong>
              <span>或点击选择本地道路图像</span>
            </div>
          </el-upload>

          <div class="threshold-card" v-if="originalImage">
            <div class="threshold-header">
              <span>置信度阈值</span>
              <strong>{{ confThreshold.toFixed(2) }}</strong>
            </div>
            <el-slider
              v-model="confThreshold"
              :min="0.1"
              :max="0.9"
              :step="0.05"
              @change="reDetect"
            />
          </div>

          <div class="route-summary">
            <div class="summary-title">路线概览</div>
            <div v-if="trafficRoutes.length === 0" class="summary-empty">等待车辆检测结果</div>
            <div v-for="route in trafficRoutes" :key="route.id" class="route-item">
              <span class="route-color" :style="{ background: route.color }"></span>
              <div>
                <strong>{{ route.name }}</strong>
                <small>{{ route.count }} 辆车 · {{ route.direction }}</small>
              </div>
            </div>
          </div>
        </section>

        <section class="vision-panel">
          <div class="panel-topbar">
            <div>
              <span class="section-kicker">Live Overlay</span>
              <h2>车流路线图</h2>
            </div>
            <div class="legend">
              <span><i class="legend-box"></i>识别框</span>
              <span><i class="legend-line"></i>车流路线</span>
              <span><i class="legend-dot"></i>车辆中心</span>
            </div>
          </div>

          <transition name="fade" mode="out-in">
            <div v-if="loading" class="state-card">
              <div class="scanner"></div>
              <strong>AI 正在重建道路态势</strong>
              <span>检测车辆、计算中心点、生成车流路线...</span>
            </div>

            <div v-else-if="!originalImage" class="state-card empty">
              <strong>等待输入视觉信号</strong>
              <span>上传图片后，这里会显示车辆识别框与车流路线。</span>
            </div>

            <div v-else class="result-stack">
              <div class="image-stage">
                <img :src="originalImage" class="base-image" alt="道路检测结果" />

                <svg class="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <marker
                      v-for="route in trafficRoutes"
                      :key="`marker-${route.id}`"
                      :id="`arrow-${route.id}`"
                      markerWidth="7"
                      markerHeight="7"
                      refX="5.5"
                      refY="3.5"
                      orient="auto"
                    >
                      <path d="M0,0 L7,3.5 L0,7 Z" :fill="route.color" />
                    </marker>
                  </defs>

                  <g v-for="route in trafficRoutes" :key="route.id">
                    <polyline
                      v-if="route.points.length > 1"
                      class="route-glow"
                      :points="formatRoutePoints(route.points)"
                      :stroke="route.color"
                    />
                    <polyline
                      v-if="route.points.length > 1"
                      class="route-line"
                      :points="formatRoutePoints(route.points)"
                      :stroke="route.color"
                      :marker-end="`url(#arrow-${route.id})`"
                    />
                    <circle
                      v-for="(point, pointIndex) in route.points"
                      :key="`${route.id}-${pointIndex}`"
                      class="route-node"
                      :cx="point.x"
                      :cy="point.y"
                      r="0.95"
                      :fill="route.color"
                    />
                  </g>
                </svg>

                <div
                  v-for="(item, index) in tableData"
                  :key="`${item.display_name}-${index}`"
                  class="bounding-box"
                  :class="{
                    'is-hovered': hoveredIndex === index,
                    'is-dimmed': hoveredIndex !== null && hoveredIndex !== index
                  }"
                  :style="getBoxStyle(item.bbox)"
                  @mouseenter="hoveredIndex = index"
                  @mouseleave="hoveredIndex = null"
                >
                  <span class="box-label">{{ item.display_name }} · {{ (item.confidence * 100).toFixed(0) }}%</span>
                </div>
              </div>

              <div class="insight-grid">
                <div class="stats-card">
                  <span class="section-kicker">Objects</span>
                  <div class="tags">
                    <span v-for="(count, name) in targetStats" :key="name" class="tag">
                      {{ name }} <strong>{{ count }}</strong>
                    </span>
                  </div>
                </div>

                <div class="stats-card">
                  <span class="section-kicker">Flow</span>
                  <p class="flow-text">{{ flowInsight }}</p>
                </div>
              </div>

              <el-table
                :data="tableData"
                height="210"
                class="traffic-table"
                @cell-mouse-enter="handleMouseEnter"
                @cell-mouse-leave="handleMouseLeave"
              >
                <el-table-column prop="display_name" label="识别对象" min-width="120">
                  <template #default="scope">
                    <span class="object-name">{{ scope.row.display_name }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="confidence" label="置信度" min-width="120" align="center">
                  <template #default="scope">
                    <div class="confidence">
                      <span :style="{ width: `${scope.row.confidence * 100}%` }"></span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="中心点" min-width="120" align="center">
                  <template #default="scope">
                    {{ getCenterLabel(scope.row.bbox) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </transition>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

interface Detection {
  class_name: string
  confidence: number
  bbox: number[]
  display_name?: string
}

interface ApiResponse {
  status: string
  message: string
  data: {
    detections: Detection[]
    img_width: number
    img_height: number
  }
}

interface RoutePoint {
  x: number
  y: number
}

interface TrafficRoute {
  id: string
  name: string
  color: string
  count: number
  direction: string
  points: RoutePoint[]
}

const VEHICLE_KEYWORDS = ['car', 'truck', 'bus', 'motorcycle', 'bike', 'bicycle', 'vehicle', 'van', 'taxi']
const ROUTE_COLORS = ['#19f5aa', '#38bdf8', '#fbbf24']

const originalImage = ref<string>('')
const tableData = ref<Detection[]>([])
const loading = ref<boolean>(false)
const confThreshold = ref<number>(0.25)
const hoveredIndex = ref<number | null>(null)
const currentImgWidth = ref<number>(1)
const currentImgHeight = ref<number>(1)
const currentFile = ref<File | null>(null)

const targetStats = computed(() => {
  const stats: Record<string, number> = {}
  tableData.value.forEach((item) => {
    stats[item.class_name] = (stats[item.class_name] || 0) + 1
  })
  return stats
})

const vehicleDetections = computed(() => {
  const matched = tableData.value.filter((item) => isVehicle(item.class_name))
  return matched.length > 0 ? matched : tableData.value
})

const trafficRoutes = computed<TrafficRoute[]>(() => {
  const vehicles = vehicleDetections.value
    .map((item) => ({
      ...item,
      center: getCenterPoint(item.bbox),
    }))
    .sort((a, b) => a.center.x - b.center.x)

  if (vehicles.length === 0) return []

  const laneGroups = [
    { id: 'upstream', name: '上侧车流', min: 0, max: 38 },
    { id: 'midstream', name: '中部车流', min: 38, max: 68 },
    { id: 'downstream', name: '下侧车流', min: 68, max: 101 },
  ]

  return laneGroups
    .map((lane, index) => {
      const points = vehicles
        .filter((item) => item.center.y >= lane.min && item.center.y < lane.max)
        .map((item) => item.center)

      return {
        id: lane.id,
        name: lane.name,
        color: ROUTE_COLORS[index],
        count: points.length,
        direction: getRouteDirection(points),
        points,
      }
    })
    .filter((route) => route.points.length > 0)
})

const flowInsight = computed(() => {
  if (vehicleDetections.value.length === 0) return '当前画面暂无可用于生成路线的车辆目标。'
  const busiest = [...trafficRoutes.value].sort((a, b) => b.count - a.count)[0]
  if (!busiest) return '车辆已识别，路线正在生成。'
  return `${busiest.name}最密集，共 ${busiest.count} 辆车，推断方向为${busiest.direction}。`
})

const isVehicle = (className: string) => {
  const normalized = className.toLowerCase()
  return VEHICLE_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

const getCenterPoint = (bbox: number[]): RoutePoint => {
  const [x1, y1, x2, y2] = bbox
  const width = currentImgWidth.value || 1
  const height = currentImgHeight.value || 1
  return {
    x: ((x1 + x2) / 2 / width) * 100,
    y: ((y1 + y2) / 2 / height) * 100,
  }
}

const getRouteDirection = (points: RoutePoint[]) => {
  if (points.length < 2) return '单点标注'
  const first = points[0]
  const last = points[points.length - 1]
  const horizontal = last.x >= first.x ? '由左向右' : '由右向左'
  const verticalDelta = last.y - first.y
  if (Math.abs(verticalDelta) < 8) return horizontal
  return `${horizontal}${verticalDelta > 0 ? '，略向下' : '，略向上'}`
}

const formatRoutePoints = (points: RoutePoint[]) => {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
}

const getCenterLabel = (bbox: number[]) => {
  const point = getCenterPoint(bbox)
  return `${point.x.toFixed(1)}%, ${point.y.toFixed(1)}%`
}

const handleMouseEnter = (row: Detection) => {
  hoveredIndex.value = tableData.value.indexOf(row)
}

const handleMouseLeave = () => {
  hoveredIndex.value = null
}

const reDetect = () => {
  if (currentFile.value) uploadImage()
}

const uploadImage = async (options?: { file?: File }) => {
  if (options?.file) {
    currentFile.value = options.file
    originalImage.value = URL.createObjectURL(currentFile.value)
  }

  if (!currentFile.value) return

  tableData.value = []
  loading.value = true

  const formData = new FormData()
  formData.append('file', currentFile.value)
  formData.append('conf', confThreshold.value.toString())

  try {
    const response = await axios.post<ApiResponse>('http://localhost:8080/api/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    const resData = response.data
    if (resData.status === 'success') {
      const typeCounts: Record<string, number> = {}
      const processedDetections = resData.data.detections.map((item) => {
        typeCounts[item.class_name] = (typeCounts[item.class_name] || 0) + 1
        return {
          ...item,
          display_name: `${item.class_name} ${typeCounts[item.class_name]}`,
        }
      })

      tableData.value = processedDetections
      currentImgWidth.value = resData.data.img_width
      currentImgHeight.value = resData.data.img_height
    } else {
      ElMessage.error(resData.message || '检测失败')
    }
  } catch {
    ElMessage.error('网络请求失败，请确认后端服务已启动')
  } finally {
    loading.value = false
  }
}

const getBoxStyle = (bbox: number[]) => {
  const [x1, y1, x2, y2] = bbox
  const width = currentImgWidth.value || 1
  const height = currentImgHeight.value || 1

  return {
    left: `${(x1 / width) * 100}%`,
    top: `${(y1 / height) * 100}%`,
    width: `${((x2 - x1) / width) * 100}%`,
    height: `${((y2 - y1) / height) * 100}%`,
  }
}
</script>

<style>
:root {
  --traffic-bg: #07110f;
  --traffic-panel: rgba(8, 24, 22, 0.72);
  --traffic-panel-strong: rgba(10, 34, 31, 0.92);
  --traffic-border: rgba(132, 255, 212, 0.18);
  --traffic-text: #effff8;
  --traffic-muted: rgba(239, 255, 248, 0.64);
  --traffic-cyan: #38bdf8;
  --traffic-green: #19f5aa;
  --traffic-amber: #fbbf24;
}

body {
  margin: 0;
  min-width: 320px;
  background: var(--traffic-bg);
}

.traffic-page {
  min-height: 100vh;
  overflow: hidden;
  position: relative;
  color: var(--traffic-text);
  background:
    linear-gradient(135deg, rgba(13, 31, 29, 0.96), rgba(2, 8, 10, 0.98)),
    radial-gradient(circle at 18% 8%, rgba(25, 245, 170, 0.22), transparent 32%),
    radial-gradient(circle at 86% 18%, rgba(56, 189, 248, 0.2), transparent 34%);
  font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif;
}

.traffic-page::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.18;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, #000, transparent 80%);
}

.aurora {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 999px;
  filter: blur(70px);
  opacity: 0.58;
  animation: drift 12s ease-in-out infinite alternate;
}

.aurora-a {
  top: -120px;
  left: -80px;
  background: rgba(25, 245, 170, 0.42);
}

.aurora-b {
  right: -120px;
  top: 120px;
  background: rgba(56, 189, 248, 0.36);
  animation-delay: -4s;
}

.aurora-c {
  left: 45%;
  bottom: -180px;
  background: rgba(251, 191, 36, 0.24);
  animation-delay: -8s;
}

.shell {
  position: relative;
  z-index: 1;
  width: min(1380px, calc(100% - 40px));
  margin: 0 auto;
  padding: 42px 0;
}

.hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 28px;
}

.eyebrow,
.section-kicker {
  margin: 0 0 10px;
  color: var(--traffic-green);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero h1,
.panel-heading h2,
.panel-topbar h2 {
  margin: 0;
  letter-spacing: -0.04em;
}

.hero h1 {
  font-size: clamp(36px, 6vw, 76px);
  line-height: 0.95;
}

.subtitle {
  max-width: 680px;
  margin: 18px 0 0;
  color: var(--traffic-muted);
  font-size: 17px;
  line-height: 1.7;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(110px, 1fr));
  gap: 12px;
  min-width: 380px;
}

.metric-card,
.control-panel,
.vision-panel,
.threshold-card,
.route-summary,
.stats-card {
  border: 1px solid var(--traffic-border);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.035));
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(22px);
}

.metric-card {
  border-radius: 22px;
  padding: 16px;
}

.metric-card span {
  display: block;
  color: var(--traffic-muted);
  font-size: 13px;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 34px;
  line-height: 1;
}

.metric-card.active {
  border-color: rgba(25, 245, 170, 0.48);
  box-shadow: 0 0 36px rgba(25, 245, 170, 0.16);
}

.dashboard {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

.control-panel,
.vision-panel {
  border-radius: 34px;
  padding: 24px;
}

.control-panel {
  position: sticky;
  top: 24px;
}

.panel-heading p {
  margin: 12px 0 22px;
  color: var(--traffic-muted);
  line-height: 1.7;
}

.traffic-upload .el-upload {
  width: 100%;
}

.traffic-upload .el-upload-dragger {
  width: 100%;
  min-height: 230px;
  border: 1px dashed rgba(25, 245, 170, 0.42);
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(25, 245, 170, 0.16), rgba(56, 189, 248, 0.08)),
    rgba(0, 0, 0, 0.18);
  transition: transform 0.3s ease, border-color 0.3s ease, background 0.3s ease;
}

.traffic-upload .el-upload-dragger:hover {
  transform: translateY(-3px);
  border-color: var(--traffic-green);
  background:
    linear-gradient(135deg, rgba(25, 245, 170, 0.23), rgba(56, 189, 248, 0.14)),
    rgba(0, 0, 0, 0.16);
}

.upload-content {
  height: 100%;
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--traffic-text);
}

.upload-content span {
  color: var(--traffic-muted);
  font-size: 13px;
}

.upload-icon {
  font-size: 48px;
  color: var(--traffic-green);
}

.upload-content.is-uploading .upload-icon {
  animation: pulse 1.1s ease-in-out infinite;
}

.threshold-card,
.route-summary {
  margin-top: 18px;
  border-radius: 24px;
  padding: 18px;
}

.threshold-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.threshold-header span,
.summary-empty,
.route-item small {
  color: var(--traffic-muted);
}

.route-summary {
  display: grid;
  gap: 12px;
}

.summary-title {
  font-weight: 800;
}

.route-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.055);
}

.route-color {
  width: 12px;
  height: 42px;
  border-radius: 999px;
  box-shadow: 0 0 20px currentColor;
}

.route-item strong,
.route-item small {
  display: block;
}

.route-item small {
  margin-top: 4px;
}

.panel-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: var(--traffic-muted);
  font-size: 12px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.legend-box,
.legend-line,
.legend-dot {
  display: inline-block;
}

.legend-box {
  width: 14px;
  height: 10px;
  border: 2px solid var(--traffic-green);
  border-radius: 4px;
}

.legend-line {
  width: 18px;
  height: 2px;
  background: var(--traffic-cyan);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--traffic-amber);
}

.state-card {
  min-height: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 28px;
  background:
    radial-gradient(circle at center, rgba(25, 245, 170, 0.16), transparent 34%),
    rgba(0, 0, 0, 0.18);
  color: var(--traffic-muted);
  text-align: center;
}

.state-card strong {
  color: var(--traffic-text);
  font-size: 20px;
}

.scanner {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  border: 1px solid rgba(25, 245, 170, 0.45);
  background: linear-gradient(180deg, transparent, rgba(25, 245, 170, 0.22), transparent);
  animation: scan 1.3s ease-in-out infinite;
}

.result-stack {
  display: grid;
  gap: 18px;
}

.image-stage {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 28px;
  background: #020707;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 30px 80px rgba(0, 0, 0, 0.38);
}

.image-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent 0 47%, rgba(25, 245, 170, 0.12) 49%, transparent 51% 100%),
    linear-gradient(180deg, transparent 0 47%, rgba(56, 189, 248, 0.1) 49%, transparent 51% 100%);
  mix-blend-mode: screen;
}

.base-image {
  display: block;
  width: 100%;
  max-height: 560px;
  object-fit: contain;
}

.route-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}

.route-glow,
.route-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.route-glow {
  stroke-width: 2.8;
  opacity: 0.22;
  filter: blur(0.7px);
}

.route-line {
  stroke-width: 0.85;
  stroke-dasharray: 3 2;
  animation: routeDash 1.5s linear infinite;
}

.route-node {
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 0.24;
  filter: drop-shadow(0 0 5px rgba(25, 245, 170, 0.85));
}

.bounding-box {
  position: absolute;
  z-index: 8;
  border: 2px solid rgba(25, 245, 170, 0.9);
  border-radius: 10px;
  background: rgba(25, 245, 170, 0.08);
  box-shadow: 0 0 18px rgba(25, 245, 170, 0.28);
  cursor: crosshair;
  transition: opacity 0.25s ease, transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.box-label {
  position: absolute;
  left: -2px;
  top: -30px;
  max-width: 190px;
  padding: 5px 9px;
  border-radius: 999px;
  color: #04110e;
  background: var(--traffic-green);
  box-shadow: 0 10px 24px rgba(25, 245, 170, 0.24);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.bounding-box.is-hovered {
  z-index: 20;
  border-color: var(--traffic-amber);
  background: rgba(251, 191, 36, 0.14);
  box-shadow: 0 0 28px rgba(251, 191, 36, 0.5);
  transform: scale(1.025);
}

.bounding-box.is-hovered .box-label {
  background: var(--traffic-amber);
}

.bounding-box.is-dimmed {
  opacity: 0.18;
}

.insight-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 14px;
}

.stats-card {
  min-height: 104px;
  border-radius: 24px;
  padding: 18px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag,
.object-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  background: rgba(25, 245, 170, 0.14);
  color: var(--traffic-text);
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 800;
}

.tag strong {
  color: var(--traffic-green);
}

.flow-text {
  margin: 0;
  color: var(--traffic-muted);
  line-height: 1.7;
}

.traffic-table {
  overflow: hidden;
  border-radius: 24px;
  --el-table-bg-color: rgba(255, 255, 255, 0.035);
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(255, 255, 255, 0.08);
  --el-table-border-color: rgba(255, 255, 255, 0.08);
  --el-table-text-color: var(--traffic-text);
  --el-table-header-text-color: var(--traffic-muted);
  --el-table-row-hover-bg-color: rgba(25, 245, 170, 0.12);
}

.confidence {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.confidence span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--traffic-green), var(--traffic-cyan));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes drift {
  to {
    transform: translate3d(34px, 26px, 0) scale(1.08);
  }
}

@keyframes pulse {
  50% {
    transform: scale(1.08);
    opacity: 0.68;
  }
}

@keyframes scan {
  0%,
  100% {
    transform: translateY(-8px);
  }
  50% {
    transform: translateY(8px);
  }
}

@keyframes routeDash {
  to {
    stroke-dashoffset: -10;
  }
}

@media (max-width: 1080px) {
  .hero,
  .dashboard {
    grid-template-columns: 1fr;
  }

  .hero {
    display: grid;
  }

  .hero-metrics {
    min-width: 0;
  }

  .control-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .shell {
    width: min(100% - 24px, 1380px);
    padding: 24px 0;
  }

  .hero-metrics,
  .insight-grid {
    grid-template-columns: 1fr;
  }

  .panel-topbar {
    display: grid;
  }

  .legend {
    justify-content: flex-start;
  }

  .control-panel,
  .vision-panel {
    padding: 18px;
    border-radius: 26px;
  }

  .base-image {
    max-height: 420px;
  }
}
</style>
