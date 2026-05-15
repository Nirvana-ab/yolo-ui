<template>
<section class="view-stack">
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
        <el-table-column prop="method" label="测速方式" />
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
</template>

<script setup>
defineProps({
  tableData: {
    type: Array,
    default: () => [],
  },
  speedRecords: {
    type: Array,
    default: () => [],
  },
  regionStats: {
    type: Array,
    default: () => [],
  },
  getTargetLabel: {
    type: Function,
    required: true,
  },
  formatBbox: {
    type: Function,
    required: true,
  },
})
</script>
