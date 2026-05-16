export const PERSON_KEYWORDS = ['person', 'pedestrian', 'people', '行人'];

export const VEHICLE_KEYWORDS = [
  'car',
  'truck',
  'bus',
  'motorcycle',
  'bike',
  'bicycle',
  'vehicle',
  'van',
  'taxi',
  '车辆',
];

export const TRACKABLE_KEYWORDS = [...PERSON_KEYWORDS, ...VEHICLE_KEYWORDS];

export const TARGET_COLORS = [
  '#ff8a2a',
  '#6bb6ff',
  '#f5c451',
  '#d9dde7',
  '#9ca7b8',
  '#ff5c5c',
  '#b8c4d8',
  '#4f83ff',
];

export const API_BASE = 'http://localhost:8080';
export const FLOW_BUCKET_SECONDS = 3;
export const VIDEO_BACKEND_CONF_THRESHOLD = 0.1;
export const MAX_REASONABLE_SPEED_KMH = 180;

export const MODEL_OPTIONS = [
  {
    label: '最新训练模型 mainTask_latest.onnx (960)',
    value: 'mainTask_latest.onnx',
    inputSize: 960,
  },
  {
    label: 'Baseline best.onnx (640)',
    value: 'best.onnx',
    inputSize: 640,
  },
];

export const views = [
  { key: 'monitor', label: '实时监控', kicker: 'Live', hint: '查看原始与识别画面' },
  { key: 'analytics', label: '统计图表', kicker: 'Charts', hint: '观察数量与趋势' },
  { key: 'tables', label: '数据表格', kicker: 'Tables', hint: '核对检测明细' },
  { key: 'calibration', label: '速度校准', kicker: 'Speed', hint: '调整测速线参数' },
  { key: 'heatmap', label: '热力图', kicker: 'Heatmap', hint: '观察目标密集区域' },
  { key: 'roi-demo', label: 'ROI补检', kicker: 'ROI', hint: '小目标风险验证' },
];
