<template>
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
        <span>上传完成后，结果会显示在右侧实时监控和检测结果区域</span>
      </div>
    </el-upload>

    <div class="form-grid">
      <label>
        <span>模型权重</span>
        <el-select v-model="selectedModel" class="full-control">
          <el-option
            v-for="option in modelOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
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
        <span>像素标定 {{ metersPerPixel.toFixed(3) }} m/px</span>
        <el-slider v-model="metersPerPixel" :min="0.005" :max="0.12" :step="0.005" />
      </label>
    </div>
  </aside>
</template>

<script setup>
import { UploadFilled } from '@element-plus/icons-vue';

defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  modelOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['upload-media', 're-analyze']);
const selectedModel = defineModel('selectedModel');
const classMode = defineModel('classMode');
const confThreshold = defineModel('confThreshold');
const metersPerPixel = defineModel('metersPerPixel');

const uploadMedia = (options) => emit('upload-media', options);
const reAnalyze = () => emit('re-analyze');
</script>
