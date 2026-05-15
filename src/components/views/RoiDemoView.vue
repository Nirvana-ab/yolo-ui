<template>
<section class="view-stack roi-demo-view">
  <div class="chart-card roi-hero">
    <div>
      <span class="section-kicker">ROI Function Verification</span>
      <h3>小目标漏检风险诊断与辅助补检模拟验证</h3>
      <p>
        本页展示离线模拟数据生成的 ROI 风险诊断、候选框 Q 分数筛选与导出文件。
        结果仅用于验证流程、界面展示和输出格式，不用于证明检测精度提升。
      </p>
    </div>
    <div class="roi-actions">
      <button class="roi-run-btn" :class="{ active: showResult }" @click="showResult = !showResult">
        {{ showResult ? '隐藏 ROI 补检效果' : '显示 ROI 补检效果' }}
      </button>
      <a v-for="file in exportFiles" :key="file.href" :href="file.href" download>{{ file.label }}</a>
    </div>
  </div>

  <div class="chart-card roi-figure-card primary">
    <div class="card-title">
      <span>{{ showResult ? 'Scene Overlay' : 'Initial Scene' }}</span>
      <strong>{{ showResult ? 'ROI 划分与辅助补检效果' : '初始合成交通场景' }}</strong>
    </div>
    <img
      :src="showResult ? '/roi-demo/fig_roi_demo_v3.png' : '/roi-demo/fig_roi_initial_scene.png'"
      :alt="showResult ? 'ROI 划分与辅助补检效果' : '初始合成交通场景'"
    />
  </div>

  <template v-if="showResult">
    <div class="roi-chart-grid">
      <div class="chart-card roi-figure-card">
        <div class="card-title">
          <span>Risk Scores</span>
          <strong>ROI 风险分数</strong>
        </div>
        <img src="/roi-demo/fig_roi_scores_v3.png" alt="ROI 风险分数柱状图" />
      </div>

      <div class="chart-card roi-figure-card">
        <div class="card-title">
          <span>Q-score</span>
          <strong>候选框 Q 分数与阈值</strong>
        </div>
        <img src="/roi-demo/fig_7_9_candidate_q_scores_v5.png" alt="候选框 Q 分数与阈值对比图" />
      </div>
    </div>
  </template>
</section>
</template>

<script setup>
import { ref } from 'vue'

const showResult = ref(false)
const exportFiles = [
  { label: '下载 JSON 报告', href: '/roi-demo/roi_report_v3.json' },
  { label: '下载 ROI CSV', href: '/roi-demo/roi_scores_v3.csv' },
  { label: '下载候选框 CSV', href: '/roi-demo/roi_candidates_v3.csv' },
]
</script>

<style scoped>
.roi-demo-view {
  gap: 18px;
}

.roi-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 20px;
}

.roi-hero h3 {
  margin: 8px 0 10px;
  color: var(--text);
  font-size: 22px;
}

.roi-hero p {
  max-width: 780px;
  margin: 0;
  color: var(--muted);
  line-height: 1.75;
}

.roi-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 168px;
}

.roi-actions a,
.roi-run-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(218, 225, 235, 0.18);
  border-radius: 12px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
  text-decoration: none;
  font-size: 13px;
}

.roi-run-btn {
  min-height: 42px;
  border-color: rgba(255, 138, 42, 0.42);
  background: rgba(255, 138, 42, 0.14);
  cursor: pointer;
  font-weight: 800;
}

.roi-run-btn.active {
  border-color: rgba(107, 182, 255, 0.45);
  background: rgba(107, 182, 255, 0.16);
}

.roi-figure-card {
  padding: 18px;
  overflow: hidden;
}

.roi-figure-card img {
  display: block;
  width: 100%;
  margin-top: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
}

.roi-chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

:global(.theme-light) .roi-actions a,
:global(.theme-light) .roi-run-btn {
  color: #1f2937;
  border-color: rgba(132, 143, 160, 0.24);
  background: rgba(15, 158, 232, 0.08);
}

:global(.theme-light) .roi-run-btn {
  border-color: rgba(15, 158, 232, 0.32);
}

@media (max-width: 900px) {
  .roi-hero,
  .roi-chart-grid {
    grid-template-columns: 1fr;
  }

  .roi-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
