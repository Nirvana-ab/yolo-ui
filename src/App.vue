<template>
  <div class="apple-container">
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>

    <div class="content-wrapper">
      <header class="hero-section">
        <h1 class="hero-title">Vision Intelligence</h1>
        <p class="hero-subtitle">动态渲染 · 专注模式 · 实时统计</p>
      </header>

      <main class="glass-panel">
        <div class="panel-layout">
          
          <!-- 左侧：交互式上传区 -->
          <div class="upload-zone">
            <h3 class="section-title">提供图像</h3>
            <el-upload
              class="apple-upload"
              drag
              action=""
              :http-request="uploadImage"
              :show-file-list="false"
              accept="image/*"
            >
              <div class="upload-content" :class="{ 'is-uploading': loading }">
                <el-icon class="upload-icon"><UploadFilled /></el-icon>
                <div class="upload-text">
                  <span class="primary-text">拖拽文件至此</span>
                  <span class="secondary-text">或点击浏览您的设备</span>
                </div>
              </div>
            </el-upload>
          </div>

          <div class="divider"></div>

          <!-- 右侧：AI 解析结果 -->
          <div class="result-zone">
            <div class="result-header">
              <h3 class="section-title">深度解析</h3>
              
              <!-- 置信度滑块 -->
              <div class="slider-wrapper" v-if="originalImage">
                <span class="slider-label">AI 敏感度: {{ confThreshold }}</span>
                <el-slider v-model="confThreshold" :min="0.1" :max="0.9" :step="0.05" @change="reDetect" />
              </div>
            </div>
            
            <transition name="fade" mode="out-in">
              <div v-if="loading" class="loading-state">
                <div class="apple-spinner"></div>
                <p>AI 正在重构视觉数据...</p>
              </div>

              <div v-else-if="!originalImage" class="empty-state">
                等待输入视觉信号
              </div>

              <div v-else class="result-content">
                
                <!-- 苹果风实时统计面板 -->
                <transition name="fade-slide" appear>
                  <div class="stats-panel" v-if="tableData.length > 0">
                    <span class="stats-title">📊 画面统计：</span>
                    <div 
                      v-for="(count, name) in targetStats" 
                      :key="name" 
                      class="apple-tag stats-tag"
                    >
                      {{ name }} 
                      <span class="stats-count">{{ count }}</span>
                    </div>
                  </div>
                </transition>

                <!-- 高清底图 + 独立编号悬浮框 -->
                <transition name="pop-up" appear>
                  <div class="interactive-image-container">
                    <img :src="originalImage" class="apple-image base-image" />
                    
                    <div 
                      v-for="(item, index) in tableData" 
                      :key="index"
                      class="bounding-box"
                      :class="{ 
                        'is-hovered': hoveredIndex === index, 
                        'is-dimmed': hoveredIndex !== null && hoveredIndex !== index 
                      }"
                      :style="getBoxStyle(item.bbox)"
                      @mouseenter="hoveredIndex = index"
                      @mouseleave="hoveredIndex = null"
                    >
                      <div class="box-label" v-show="hoveredIndex === index || hoveredIndex === null">
                        {{ item.display_name }} {{ (item.confidence * 100).toFixed(0) }}%
                      </div>
                    </div>
                  </div>
                </transition>
                
                <!-- 悬浮联动数据表 -->
                <transition name="slide-up" appear>
                  <div class="data-table-wrapper">
                    <!-- 🌟 重点修正：改用更灵敏的 cell 事件来保证 100% 触发 -->
                    <el-table 
                      :data="tableData" 
                      style="width: 100%" 
                      height="200" 
                      class="apple-table"
                      @cell-mouse-enter="handleMouseEnter"
                      @cell-mouse-leave="handleMouseLeave"
                    >
                      <el-table-column prop="display_name" label="识别对象" align="left">
                        <template #default="scope">
                          <span class="apple-tag">{{ scope.row.display_name }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column prop="confidence" label="置信度" align="center">
                        <template #default="scope">
                          <div class="confidence-bar-bg">
                            <div class="confidence-bar-fill" :style="{ width: scope.row.confidence * 100 + '%' }"></div>
                          </div>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </transition>

              </div>
            </transition>
          </div>

        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

interface Detection {
  class_name: string;
  confidence: number;
  bbox: number[];
  display_name?: string;
}

interface ApiResponse {
  status: string;
  message: string;
  data: {
    detections: Detection[];
    img_width: number;
    img_height: number;
  }
}

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
  tableData.value.forEach(item => {
    if (stats[item.class_name]) {
      stats[item.class_name]++
    } else {
      stats[item.class_name] = 1
    }
  })
  return stats
})

// 触发逻辑
const handleMouseEnter = (row: Detection) => { hoveredIndex.value = tableData.value.indexOf(row) }
const handleMouseLeave = () => { hoveredIndex.value = null }
const reDetect = () => { if (currentFile.value) uploadImage() }

const uploadImage = async (options?: any) => {
  if (options && options.file) {
    currentFile.value = options.file as File
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
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    const resData = response.data
    if (resData.status === 'success') {
      setTimeout(() => {
        const typeCounts: Record<string, number> = {}
        const processedDetections = resData.data.detections.map(item => {
          if (!typeCounts[item.class_name]) typeCounts[item.class_name] = 0
          typeCounts[item.class_name]++
          return {
            ...item,
            display_name: `${item.class_name} ${typeCounts[item.class_name]}`
          }
        })

        tableData.value = processedDetections
        currentImgWidth.value = resData.data.img_width
        currentImgHeight.value = resData.data.img_height
        loading.value = false
      }, 300)
    } else {
      ElMessage.error(resData.message)
      loading.value = false
    }
  } catch (error) {
    ElMessage.error('网络请求失败')
    loading.value = false
  }
}

const getBoxStyle = (bbox: number[]) => {
  const [x1, y1, x2, y2] = bbox
  const w = currentImgWidth.value
  const h = currentImgHeight.value
  return {
    left: `${(x1 / w) * 100}%`,
    top: `${(y1 / h) * 100}%`,
    width: `${((x2 - x1) / w) * 100}%`,
    height: `${((y2 - y1) / h) * 100}%`
  }
}
</script>

<style>
:root {
  --apple-blue: #0071e3;
  --apple-bg: #fbfbfd;
  --apple-text: #1d1d1f;
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.5);
}

body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--apple-text); margin: 0; }

.apple-container { min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 40px 20px; position: relative; }
.bg-orb { position: absolute; border-radius: 50%; filter: blur(80px); z-index: 0; opacity: 0.6; animation: float 10s infinite alternate ease-in-out; }
.orb-1 { width: 400px; height: 400px; background: #ffb6ff; top: -100px; left: -100px; }
.orb-2 { width: 500px; height: 500px; background: #a3d8ff; bottom: -150px; right: -100px; animation-delay: -5s; }
@keyframes float { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(50px,50px) scale(1.1); } }

.content-wrapper { z-index: 1; max-width: 1100px; width: 100%; }
.hero-section { text-align: center; margin-bottom: 40px; }
.hero-title { font-size: 48px; font-weight: 700; margin-bottom: 10px; background: linear-gradient(90deg, #1d1d1f, #434345); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-subtitle { color: #86868b; font-size: 20px; margin: 0; }

.glass-panel { background: var(--glass-bg); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid var(--glass-border); border-radius: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); padding: 40px; }
.panel-layout { display: flex; gap: 40px; }
.upload-zone, .result-zone { flex: 1; display: flex; flex-direction: column; }
.divider { width: 1px; background: rgba(0,0,0,0.08); margin: 0 10px; }
.section-title { font-size: 20px; font-weight: 600; margin: 0 0 20px 0; }

.apple-upload .el-upload-dragger { background: rgba(255,255,255,0.5); border: 2px dashed rgba(0,0,0,0.1); border-radius: 24px; height: 200px; display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
.apple-upload .el-upload-dragger:hover { border-color: var(--apple-blue); background: #fff; transform: scale(1.02); }
.upload-icon { font-size: 48px; color: var(--apple-blue); margin-bottom: 10px; }

.result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.slider-wrapper { display: flex; align-items: center; gap: 15px; flex: 1; justify-content: flex-end; }
.slider-label { font-size: 13px; color: #86868b; font-weight: 500; white-space: nowrap; }

.stats-panel { background: rgba(255,255,255,0.6); padding: 12px 16px; border-radius: 16px; margin-bottom: 20px; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.stats-title { font-size: 14px; font-weight: 600; color: var(--apple-text); }
.stats-tag { padding: 6px 12px !important; font-size: 14px !important; display: flex; align-items: center; gap: 6px; }
.stats-count { background: var(--apple-blue); color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold; }

.interactive-image-container { position: relative; width: 100%; border-radius: 20px; overflow: hidden; background: rgba(0,0,0,0.03); box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
.base-image { width: 100%; max-height: 400px; object-fit: contain; display: block; }

/* 🌟 悬浮框默认状态 */
.bounding-box { position: absolute; border: 2px solid rgba(52,199,89,0.8); border-radius: 8px; background: rgba(52,199,89,0.1); transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1); cursor: crosshair; z-index: 10; }
.box-label { position: absolute; top: -26px; left: -2px; background: rgba(52,199,89,0.95); color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; transition: all 0.3s; }

/* 🌟 被选中的框：发光、放大 */
.bounding-box.is-hovered { border-color: #0071e3; background: rgba(0,113,227,0.2); box-shadow: 0 0 20px rgba(0,113,227,0.5); transform: scale(1.02); z-index: 100; }
.bounding-box.is-hovered .box-label { background: rgba(0,113,227,0.95); transform: scale(1.1); transform-origin: bottom left; }

/* 🌟🌟 没被选中的框：强制隐藏透明，缩小，不阻挡鼠标 🌟🌟 */
.bounding-box.is-dimmed { 
  opacity: 0 !important; 
  transform: scale(0.8) !important; 
  pointer-events: none !important; 
}

.data-table-wrapper { margin-top: 20px; background: rgba(255,255,255,0.6); border-radius: 16px; padding: 10px; }
.apple-table { --el-table-bg-color: transparent !important; --el-table-tr-bg-color: transparent !important; --el-table-border-color: transparent !important; }
.el-table__body tr { cursor: pointer; }
.el-table__body tr:hover > td { background-color: rgba(0,113,227,0.05) !important; }
.apple-tag { background: #e8f2ff; color: var(--apple-blue); padding: 4px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
.confidence-bar-bg { height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; }
.confidence-bar-fill { height: 100%; background: linear-gradient(90deg, #34c759, #32ade6); border-radius: 3px; }

.empty-state, .loading-state { height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #86868b; background: rgba(0,0,0,0.02); border-radius: 20px; }
.apple-spinner { width: 40px; height: 40px; border: 4px solid rgba(0,113,227,0.2); border-top-color: var(--apple-blue); border-radius: 50%; animation: spin 1s infinite linear; margin-bottom: 15px; }
@keyframes spin { 100% { transform: rotate(360deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.pop-up-enter-active { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.pop-up-enter-from { opacity: 0; transform: scale(0.95); }
.slide-up-enter-active { transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1) 0.1s; }
.slide-up-enter-from { opacity: 0; transform: translateY(20px); }
.fade-slide-enter-active { transition: all 0.4s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(-10px); }
</style>