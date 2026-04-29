<template>
  <div class="traffic-page" :class="isDarkTheme ? 'theme-dark' : 'theme-light'">
    <div class="beam beam-a"></div>
    <div class="beam beam-b"></div>
    <div class="beam beam-c"></div>

    <div class="shell">
      <div class="window-bar">
        <div class="window-dots">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <strong>基于深度学习的交通流量预测系统</strong>
        <div class="theme-switch">
          <span>浅色</span>
          <el-switch v-model="isDarkTheme" />
          <span>深色</span>
        </div>
      </div>

      <header class="hero">
        <div>
          <p class="eyebrow">YOLOv8 Traffic Intelligence</p>
          <h1>交通安全智能分析平台</h1>
          <p class="subtitle">
            面向监控视频的行人、车辆检测与多目标跟踪系统，支持位置框、轨迹、计数、测速、区域分布和热力图统计。
          </p>
        </div>

        <div class="hero-metrics">
          <div class="metric-card">
            <span>检测目标</span>
            <strong>{{ tableData.length }}</strong>
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
            <span>平均速度</span>
            <strong>{{ averageSpeedText }}</strong>
          </div>
        </div>
      </header>

      <main class="workspace">
        <aside class="control-panel">
          <div class="panel-heading">
            <span class="section-kicker">Control Center</span>
            <h2>分析控制台</h2>
            <p>选择视频、模型和检测类别，调整基础识别参数。</p>
          </div>

          <el-upload
            class="traffic-upload"
            drag
            action=""
            :http-request="uploadMedia"
            :show-file-list="false"
            accept="image/*,video/*"
          >
            <div class="upload-content" :class="{ 'is-uploading': loading }">
              <el-icon class="upload-icon"><UploadFilled /></el-icon>
              <strong>{{ loading ? '正在处理监控画面...' : '拖拽视频或图片到这里' }}</strong>
              <span>上传完成后，结果会显示在右侧“实时监控 / 检测结果”区域</span>
            </div>
          </el-upload>

          <div class="form-grid">
            <label>
              <span>模型权重</span>
              <el-select v-model="selectedModel" class="full-control">
                <el-option label="Baseline best.onnx" value="best.onnx" />
                <el-option label="YOLOv8n 轻量模型" value="yolov8n.onnx" />
                <el-option label="YOLOv8s 平衡模型" value="yolov8s.onnx" />
                <el-option label="自定义权重文件" value="custom" />
              </el-select>
            </label>

            <label>
              <span>检测类别</span>
              <el-select v-model="classMode" class="full-control">
                <el-option label="行人 + 车辆" value="traffic" />
                <el-option label="仅车辆" value="vehicle" />
                <el-option label="全部类别" value="all" />
              </el-select>
            </label>

            <label>
              <span>置信度阈值 {{ confThreshold.toFixed(2) }}</span>
              <el-slider v-model="confThreshold" :min="0.1" :max="0.9" :step="0.05" @change="reAnalyze" />
            </label>

            <label>
              <span>像素标定 {{ metersPerPixel.toFixed(2) }} m/px</span>
              <el-slider v-model="metersPerPixel" :min="0.02" :max="0.5" :step="0.01" />
            </label>
          </div>
        </aside>

        <section class="main-panel">
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

          <div class="panel-topbar">
            <div>
              <span class="section-kicker">{{ activeViewMeta.kicker }}</span>
              <h2>{{ activeViewMeta.label }}</h2>
            </div>
            <div class="status-pills">
              <span><i class="legend-box"></i>位置框</span>
              <span><i class="legend-line"></i>轨迹</span>
              <span><i class="legend-dot"></i>目标中心</span>
            </div>
          </div>

          <transition name="fade" mode="out-in">
            <section v-if="activeView === 'monitor'" key="monitor" class="view-stack">
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
                      ></video>
                      <img v-else :src="mediaUrl" class="base-image" :alt="showDetectionOverlay ? '检测结果' : '原始画面'" />

                      <template v-if="showDetectionOverlay">
                        <svg class="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
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
                            />
                          </g>
                          <line x1="0" x2="100" :y1="speedLineA" :y2="speedLineA" class="speed-line line-a" />
                          <line x1="0" x2="100" :y1="speedLineB" :y2="speedLineB" class="speed-line line-b" />
                        </svg>

                        <span
                          v-for="(item, index) in tableData"
                          :key="`center-${item.display_name}-${index}`"
                          class="target-center-dot"
                          :style="getCenterStyle(item.bbox, ROUTE_COLORS[index % ROUTE_COLORS.length])"
                        ></span>

                        <div
                          v-for="(item, index) in tableData"
                          :key="`${item.display_name}-${index}`"
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

            <section v-else-if="activeView === 'analytics'" key="analytics" class="view-stack">
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
                    <circle v-for="point in flowSeries" :key="point.x" :cx="point.x" :cy="point.y" r="3" />
                  </svg>
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

            <section v-else-if="activeView === 'tables'" key="tables" class="view-stack">
              <el-tabs class="data-tabs">
                <el-tab-pane label="检测记录">
                  <el-table :data="tableData" height="420" class="traffic-table">
                    <el-table-column prop="display_name" label="目标" min-width="140" />
                    <el-table-column label="类别" min-width="110">
                      <template #default="scope">{{ getTargetLabel(scope.row.class_name) }}</template>
                    </el-table-column>
                    <el-table-column label="编号" min-width="90" align="center">
                      <template #default="scope">{{ scope.row.track_id ?? '-' }}</template>
                    </el-table-column>
                    <el-table-column label="置信度" min-width="120" align="center">
                      <template #default="scope">{{ (scope.row.confidence * 100).toFixed(1) }}%</template>
                    </el-table-column>
                    <el-table-column label="位置框" min-width="220">
                      <template #default="scope">{{ formatBbox(scope.row.bbox) }}</template>
                    </el-table-column>
                  </el-table>
                </el-tab-pane>
                <el-tab-pane label="速度记录">
                  <el-table :data="speedRecords" height="420" class="traffic-table">
                    <el-table-column prop="name" label="目标" />
                    <el-table-column prop="direction" label="方向" />
                    <el-table-column prop="speed" label="估算速度" />
                    <el-table-column prop="points" label="轨迹点" />
                  </el-table>
                </el-tab-pane>
                <el-tab-pane label="区域统计">
                  <el-table :data="regionStats" height="420" class="traffic-table">
                    <el-table-column prop="name" label="区域" />
                    <el-table-column prop="count" label="目标数量" />
                    <el-table-column prop="percentLabel" label="占比" />
                  </el-table>
                </el-tab-pane>
              </el-tabs>
            </section>

            <section v-else-if="activeView === 'calibration'" key="calibration" class="view-stack">
              <div class="calibration-grid">
                <div class="chart-card calibration-settings">
                  <div class="card-title">
                    <span>Dual Speed Lines</span>
                    <strong>速度校准配置</strong>
                  </div>
                  <p class="flow-text">
                    拖动下方滑块即可调整两条测速线和实际线间距离，右侧预览会同步显示位置变化。
                  </p>
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
                  </div>
                  <div class="calibration-values">
                    <span>算法说明：目标先后穿越 A / B 两条线后，根据时间差计算速度。</span>
                    <span>像素标定：{{ metersPerPixel.toFixed(2) }} m/px</span>
                  </div>
                </div>
                <div class="chart-card calibration-preview">
                  <div class="speed-line-preview" :style="{ top: `${speedLineA}%` }">Line A</div>
                  <div class="speed-line-preview line-b-preview" :style="{ top: `${speedLineB}%` }">Line B</div>
                </div>
              </div>
            </section>

            <section v-else key="heatmap" class="view-stack">
              <div class="heatmap-panel">
                <div v-for="point in heatmapPoints" :key="point.id" class="heat-point" :style="point.style"></div>
                <div class="heatmap-empty" v-if="heatmapPoints.length === 0">
                  <strong>等待轨迹热力图</strong>
                  <span>上传视频并完成追踪后，将基于目标轨迹生成热区分布。</span>
                </div>
              </div>
            </section>
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

type MediaType = 'image' | 'video'
type RawPoint = [number, number] | { x: number; y: number }
type ViewKey = 'monitor' | 'analytics' | 'tables' | 'calibration' | 'heatmap'

interface Detection {
  class_name: string
  confidence: number
  bbox: number[]
  display_name?: string
  track_id?: number
  center?: RawPoint
  trajectory?: RawPoint[]
  direction?: string
  speed?: number
}

interface DetectResponse {
  status: string
  message?: string
  data: {
    detections: Detection[]
    img_width: number
    img_height: number
  }
}

interface TrackResponse {
  status: string
  message?: string
  data: {
    tracks: Detection[]
    img_width: number
    img_height: number
    frame_count?: number
    fps?: number
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
  speedText: string
  points: RoutePoint[]
}

const PERSON_KEYWORDS = ['person', 'pedestrian', 'people', '行人']
const VEHICLE_KEYWORDS = ['car', 'truck', 'bus', 'motorcycle', 'bike', 'bicycle', 'vehicle', 'van', 'taxi', '车辆']
const TRACKABLE_KEYWORDS = [...PERSON_KEYWORDS, ...VEHICLE_KEYWORDS]
const ROUTE_COLORS = ['#ff8a2a', '#6bb6ff', '#f5c451', '#d9dde7', '#9ca7b8', '#ff5c5c', '#b8c4d8', '#4f83ff']

const views: Array<{ key: ViewKey; label: string; kicker: string; hint: string }> = [
  { key: 'monitor', label: '实时监控', kicker: 'Live', hint: '查看原始与识别画面' },
  { key: 'analytics', label: '统计图表', kicker: 'Charts', hint: '观察数量与趋势' },
  { key: 'tables', label: '数据表格', kicker: 'Tables', hint: '核对检测明细' },
  { key: 'calibration', label: '速度校准', kicker: 'Speed', hint: '调整测速线参数' },
  { key: 'heatmap', label: '轨迹热力图', kicker: 'Heatmap', hint: '分析高频通行区域' },
]

const activeView = ref<ViewKey>('monitor')
const isDarkTheme = ref(false)
const showDetectionOverlay = ref(true)
const mediaUrl = ref<string>('')
const mediaType = ref<MediaType>('image')
const tableData = ref<Detection[]>([])
const loading = ref<boolean>(false)
const confThreshold = ref<number>(0.25)
const hoveredIndex = ref<number | null>(null)
const currentImgWidth = ref<number>(1)
const currentImgHeight = ref<number>(1)
const currentFile = ref<File | null>(null)
const frameCount = ref<number>(0)
const fps = ref<number>(0)
const selectedModel = ref('best.onnx')
const classMode = ref('traffic')
const metersPerPixel = ref(0.12)
const speedLineA = ref(38)
const speedLineB = ref(68)
const lineDistanceMeters = ref(28)

const activeViewMeta = computed(() => views.find((view) => view.key === activeView.value) || views[0])

const canvasStyle = computed(() => {
  const width = currentImgWidth.value || 1
  const height = currentImgHeight.value || 1
  const ratio = width / height
  const maxCanvasHeight = 680
  const maxCanvasWidth = Math.round(Math.max(360, Math.min(1280, ratio * maxCanvasHeight)))

  return {
    aspectRatio: `${width} / ${height}`,
    maxWidth: `${maxCanvasWidth}px`,
  }
})

const targetStats = computed(() => {
  const stats: Record<string, number> = {}
  filteredTableData.value.forEach((item) => {
    const label = getTargetLabel(item.class_name)
    stats[label] = (stats[label] || 0) + 1
  })
  return stats
})

const filteredTableData = computed(() => {
  if (classMode.value === 'all') return tableData.value
  if (classMode.value === 'vehicle') return tableData.value.filter((item) => isVehicle(item.class_name))
  return tableData.value.filter((item) => isTrackable(item.class_name))
})

const pedestrianCount = computed(() => filteredTableData.value.filter((item) => isPedestrian(item.class_name)).length)
const vehicleCount = computed(() => filteredTableData.value.filter((item) => isVehicle(item.class_name)).length)

const trafficRoutes = computed<TrafficRoute[]>(() => {
  return filteredTableData.value.map((item, index) => {
    const fallbackCenter = item.center || getCenterPixel(item.bbox)
    const points = normalizeTrajectory(item.trajectory?.length ? item.trajectory : [fallbackCenter])
    const direction = item.direction || getRouteDirection(points)

    return {
      id: String(item.track_id ?? `det-${index}`),
      name: item.track_id !== undefined ? `${getTargetLabel(item.class_name)} #${item.track_id}` : item.display_name || `${item.class_name} ${index + 1}`,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
      count: 1,
      direction,
      speedText: formatSpeed(item.speed),
      points,
    }
  })
})

const flowInsight = computed(() => {
  if (filteredTableData.value.length === 0) return '当前画面暂无可用于统计的行人或车辆目标。'
  const regions = regionStats.value.map((region) => `${region.name}${region.count}`).join('，')
  return `已识别 ${filteredTableData.value.length} 个目标，其中行人 ${pedestrianCount.value} 个、车辆 ${vehicleCount.value} 辆。区域分布：${regions}。`
})

const classDistribution = computed(() => {
  const entries = Object.entries(targetStats.value)
  const max = Math.max(...entries.map(([, count]) => count), 1)
  return entries.map(([name, count]) => ({
    name,
    count,
    percent: Math.max(8, (count / max) * 100),
  }))
})

const regionStats = computed(() => {
  const regions = [
    { name: '近景区域', min: 66, max: 101, count: 0 },
    { name: '中景区域', min: 34, max: 66, count: 0 },
    { name: '远景区域', min: 0, max: 34, count: 0 },
  ]

  filteredTableData.value.forEach((item) => {
    const center = getCenterPercent(item.bbox)
    const region = regions.find((candidate) => center.y >= candidate.min && center.y < candidate.max)
    if (region) region.count++
  })

  const max = Math.max(...regions.map((region) => region.count), 1)
  const total = Math.max(filteredTableData.value.length, 1)
  return regions.map((region) => ({
    ...region,
    percent: Math.max(8, (region.count / max) * 100),
    percentLabel: `${((region.count / total) * 100).toFixed(1)}%`,
  }))
})

const speedRecords = computed(() => {
  return trafficRoutes.value.map((route) => ({
    name: route.name,
    direction: route.direction,
    speed: route.speedText,
    points: route.points.length,
  }))
})

const averageSpeedText = computed(() => {
  const speeds = filteredTableData.value
    .map((item) => item.speed)
    .filter((speed): speed is number => typeof speed === 'number' && Number.isFinite(speed))
  if (speeds.length === 0) return '--'
  const avg = speeds.reduce((sum, speed) => sum + toKmh(speed), 0) / speeds.length
  return `${avg.toFixed(1)}`
})

const speedBuckets = computed(() => {
  const buckets = [
    { label: '0-20', min: 0, max: 20, count: 0 },
    { label: '20-40', min: 20, max: 40, count: 0 },
    { label: '40-60', min: 40, max: 60, count: 0 },
    { label: '60+', min: 60, max: Infinity, count: 0 },
  ]
  filteredTableData.value.forEach((item) => {
    const speed = typeof item.speed === 'number' ? toKmh(item.speed) : 0
    const bucket = buckets.find((candidate) => speed >= candidate.min && speed < candidate.max)
    if (bucket) bucket.count++
  })
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1)
  return buckets.map((bucket) => ({ ...bucket, percent: Math.max(8, (bucket.count / max) * 100) }))
})

const flowSeries = computed(() => {
  const base = Math.max(filteredTableData.value.length, 1)
  return Array.from({ length: 8 }, (_, index) => {
    const value = Math.max(0, base + Math.round(Math.sin(index * 0.9) * base * 0.35) + index)
    return {
      x: 16 + index * 41,
      y: 132 - Math.min(110, value * 9),
    }
  })
})

const flowSeriesPoints = computed(() => flowSeries.value.map((point) => `${point.x},${point.y}`).join(' '))

const heatmapPoints = computed(() => {
  return trafficRoutes.value.flatMap((route, routeIndex) =>
    route.points.map((point, pointIndex) => ({
      id: `${route.id}-${pointIndex}`,
      style: {
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: `${18 + routeIndex * 3}px`,
        height: `${18 + routeIndex * 3}px`,
        background: `radial-gradient(circle, ${route.color} 0%, rgba(255,255,255,0.1) 35%, transparent 70%)`,
      },
    })),
  )
})

const isPedestrian = (className: string) => {
  const normalized = className.toLowerCase()
  return PERSON_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

const isVehicle = (className: string) => {
  const normalized = className.toLowerCase()
  return VEHICLE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

const isTrackable = (className: string) => {
  const normalized = className.toLowerCase()
  return TRACKABLE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

const getTargetLabel = (className: string) => {
  if (isPedestrian(className)) return '行人'
  if (isVehicle(className)) return '车辆'
  return className
}

const normalizeTrajectory = (points: RawPoint[] = []) => {
  return points.map((point) => {
    const [x, y] = Array.isArray(point) ? point : [point.x, point.y]
    return {
      x: normalizeCoordinate(x, currentImgWidth.value),
      y: normalizeCoordinate(y, currentImgHeight.value),
    }
  })
}

const normalizeCoordinate = (value: number, max: number) => {
  if (value <= 1) return value * 100
  return (value / (max || 1)) * 100
}

const getCenterPixel = (bbox: number[]): RoutePoint => {
  const [x1, y1, x2, y2] = bbox
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  }
}

const getCenterPercent = (bbox: number[]): RoutePoint => {
  const [x1, y1, x2, y2] = bbox
  return {
    x: ((x1 + x2) / 2 / (currentImgWidth.value || 1)) * 100,
    y: ((y1 + y2) / 2 / (currentImgHeight.value || 1)) * 100,
  }
}

const getRouteDirection = (points: RoutePoint[]) => {
  if (points.length < 2) return '单点标注'
  const first = points[0]
  const last = points[points.length - 1]
  const dx = last.x - first.x
  const dy = last.y - first.y
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? '由左向右' : '由右向左'
  return dy >= 0 ? '由上向下' : '由下向上'
}

const formatRoutePoints = (points: RoutePoint[]) => {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
}

const toKmh = (pixelSpeed: number) => pixelSpeed * metersPerPixel.value * 3.6

const formatSpeed = (speed?: number) => {
  if (typeof speed !== 'number' || !Number.isFinite(speed)) return '--'
  return `${toKmh(speed).toFixed(1)} km/h`
}

const formatBbox = (bbox: number[]) => {
  return bbox.map((value) => value.toFixed(0)).join(', ')
}

const reAnalyze = () => {
  if (currentFile.value) uploadMedia()
}

const uploadMedia = async (options?: { file?: File }) => {
  if (options?.file) {
    currentFile.value = options.file
    mediaType.value = options.file.type.startsWith('video/') ? 'video' : 'image'
    mediaUrl.value = URL.createObjectURL(options.file)
    activeView.value = 'monitor'
    showDetectionOverlay.value = true
  }

  if (!currentFile.value) return

  tableData.value = []
  frameCount.value = 0
  fps.value = 0
  loading.value = true

  const formData = new FormData()
  formData.append('file', currentFile.value)
  formData.append('conf', confThreshold.value.toString())
  formData.append('model', selectedModel.value)
  formData.append('classes', classMode.value)

  try {
    if (mediaType.value === 'video') {
      await requestTrack(formData)
    } else {
      await requestDetect(formData)
    }
    activeView.value = 'monitor'
  } finally {
    loading.value = false
  }
}

const requestDetect = async (formData: FormData) => {
  try {
    const response = await axios.post<DetectResponse>('http://localhost:8080/api/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    const resData = response.data
    if (resData.status !== 'success') {
      ElMessage.error(resData.message || '检测失败')
      return
    }

    currentImgWidth.value = resData.data.img_width
    currentImgHeight.value = resData.data.img_height
    tableData.value = withDisplayNames(resData.data.detections)
  } catch {
    ElMessage.error('图片检测失败，请确认后端服务已启动')
  }
}

const requestTrack = async (formData: FormData) => {
  try {
    const response = await axios.post<TrackResponse>('http://localhost:8080/api/track', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    const resData = response.data
    if (resData.status !== 'success') {
      ElMessage.error(resData.message || '视频追踪失败')
      return
    }

    currentImgWidth.value = resData.data.img_width
    currentImgHeight.value = resData.data.img_height
    frameCount.value = resData.data.frame_count || 0
    fps.value = resData.data.fps || 0
    tableData.value = withDisplayNames(resData.data.tracks)
  } catch {
    ElMessage.error('视频追踪失败，请确认后端服务已启动')
  }
}

const withDisplayNames = (items: Detection[]) => {
  const typeCounts: Record<string, number> = {}

  return items.map((item) => {
    const label = getTargetLabel(item.class_name)
    typeCounts[label] = (typeCounts[label] || 0) + 1
    return {
      ...item,
      display_name:
        item.track_id !== undefined
          ? `${label} #${item.track_id}`
          : `${label} ${typeCounts[label]}`,
    }
  })
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

const getCenterStyle = (bbox: number[], color: string) => {
  const center = getCenterPercent(bbox)
  return {
    left: `${center.x}%`,
    top: `${center.y}%`,
    background: color,
    boxShadow: `0 0 0 2px rgba(255, 255, 255, 0.86), 0 0 8px ${color}`,
  }
}
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
.speed-card,
.video-card,
.stats-card,
.chart-card,
.route-summary {
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
.form-grid label span,
.speed-line-control span {
  color: var(--muted);
  font-size: 13px;
}

.upload-icon {
  color: var(--orange);
  font-size: 42px;
}

.form-grid,
.speed-card,
.route-summary {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.form-grid label {
  display: grid;
  gap: 8px;
}

.speed-card,
.route-summary {
  border-radius: 22px;
  padding: 18px;
}

.speed-line-control {
  display: grid;
  gap: 4px;
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
.legend-line,
.legend-dot {
  display: inline-block;
}

.legend-box {
  width: 14px;
  height: 10px;
  border: 2px solid var(--orange);
  border-radius: 4px;
}

.legend-line {
  width: 18px;
  height: 2px;
  background: var(--blue);
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

.video-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
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
.heatmap-panel,
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
.heatmap-panel::after,
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

.empty-stage,
.heatmap-empty {
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

.route-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
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
  stroke-width: 0.95;
  stroke-dasharray: 3 2;
  animation: routeDash 1.5s linear infinite;
}

.route-node {
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 0.16;
  filter: drop-shadow(0 0 2px rgba(15, 158, 232, 0.35));
}

.target-center-dot {
  position: absolute;
  z-index: 9;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.speed-line {
  stroke-width: 0.5;
  stroke-dasharray: 2 1;
}

.line-a {
  stroke: var(--orange);
}

.line-b {
  stroke: var(--blue);
}

.bounding-box {
  position: absolute;
  z-index: 8;
  border: 2px solid rgba(255, 138, 42, 0.9);
  border-radius: 10px;
  background: rgba(255, 138, 42, 0.08);
  box-shadow: 0 0 20px rgba(255, 138, 42, 0.26);
  transition: opacity 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
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

.region-mini span,
.tag {
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

.heatmap-panel {
  min-height: 620px;
}

.heat-point {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  filter: blur(3px);
  opacity: 0.84;
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
  background: linear-gradient(90deg, var(--orange), var(--blue));
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

@keyframes routeDash {
  to {
    stroke-dashoffset: -10;
  }
}

@media (max-width: 1180px) {
  .hero,
  .workspace,
  .video-grid,
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
.theme-light .speed-card,
.theme-light .video-card,
.theme-light .stats-card,
.theme-light .chart-card,
.theme-light .route-summary {
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

.theme-light .traffic-upload .el-upload-dragger,
.theme-light .media-stage,
.theme-light .heatmap-panel,
.theme-light .calibration-preview {
  border-color: rgba(132, 143, 160, 0.24);
  background:
    linear-gradient(135deg, rgba(250, 252, 255, 0.95), rgba(234, 239, 247, 0.86)),
    radial-gradient(circle at 50% 35%, rgba(15, 158, 232, 0.08), transparent 42%);
}

.theme-light .processed-stage::after,
.theme-light .heatmap-panel::after,
.theme-light .calibration-preview::after {
  background:
    linear-gradient(90deg, transparent 0 48%, rgba(15, 158, 232, 0.14) 49%, transparent 51% 100%),
    linear-gradient(180deg, transparent 0 48%, rgba(141, 124, 246, 0.12) 49%, transparent 51% 100%),
    repeating-linear-gradient(0deg, transparent 0 18px, rgba(100, 116, 139, 0.055) 19px, transparent 20px);
}

.theme-light .view-nav button,
.theme-light .status-pills span,
.theme-light .region-mini span,
.theme-light .tag,
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

.speed-card {
  margin-top: 14px;
  padding: 14px;
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
.heatmap-panel,
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 20px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.055);
}

.main-panel > .view-nav button {
  min-height: 86px;
  padding: 13px 14px;
  border-radius: 16px;
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
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  line-height: 1.35;
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
