<template>
<div class="window-bar">
  <div class="window-dots">
    <i></i>
    <i></i>
    <i></i>
  </div>
  <strong>基于深度学习的交通流量预测系统</strong>
  <div class="theme-switch">
    <span>浅色</span>
    <el-switch v-model="isDark" />
    <span>深色</span>
  </div>
</div>
</template>

<script setup>
const isDark = defineModel('dark')
</script>
