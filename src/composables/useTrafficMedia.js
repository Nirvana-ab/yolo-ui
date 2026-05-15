import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE, VIDEO_BACKEND_CONF_THRESHOLD } from '../constants/traffic';

export function useTrafficMedia(state, analysis) {
  const {
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
  } = state;

  const { recordFlowPoint, withDisplayNames } = analysis;

  const reAnalyze = () => {
    if (mediaType.value === 'video') return;
    if (currentFile.value) uploadMedia();
  };

  const handleVideoTimeUpdate = (event) => {
    const video = event.target;
    currentVideoTime.value = video.currentTime || 0;
    if (video.videoWidth && video.videoHeight) {
      currentImgWidth.value = video.videoWidth;
      currentImgHeight.value = video.videoHeight;
    }
  };

  const handleVideoPlay = () => {
    videoEnded.value = false;
  };

  const handleVideoEnded = (event) => {
    const video = event.target;
    currentVideoTime.value = video.currentTime || 0;
    videoEnded.value = true;
  };

  const uploadMedia = async (options) => {
    stopBackendVideoStream();
    if (options?.file) {
      currentFile.value = options.file;
      mediaType.value = options.file.type.startsWith('video/') ? 'video' : 'image';
      mediaUrl.value = URL.createObjectURL(options.file);
      activeView.value = 'monitor';
      showDetectionOverlay.value = true;
    }
    if (!currentFile.value) return;

    tableData.value = [];
    detectionFrameCache.value = {};
    flowHistory.value = [];
    frameCount.value = 0;
    fps.value = 0;
    currentVideoTime.value = 0;
    videoEnded.value = false;
    lastReceivedFrame.value = 0;

    if (mediaType.value === 'video') {
      await startBackendVideoStream();
      return;
    }

    loading.value = true;
    const formData = new FormData();
    formData.append('file', currentFile.value);
    formData.append('conf', confThreshold.value.toString());
    formData.append('model', selectedModel.value);
    formData.append('classes', classMode.value);
    try {
      await requestDetect(formData);
      activeView.value = 'monitor';
    } finally {
      loading.value = false;
    }
  };

  const startBackendVideoStream = async () => {
    if (!currentFile.value) return;
    loading.value = true;
    const formData = new FormData();
    formData.append('file', currentFile.value);
    formData.append('conf', VIDEO_BACKEND_CONF_THRESHOLD.toString());
    formData.append('model', selectedModel.value);
    formData.append('classes', classMode.value);
    try {
      const response = await axios.post(`${API_BASE}/api/stream/start`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const resData = response.data;
      if (resData.status !== 'success') {
        ElMessage.error(resData.message || '视频流启动失败');
        return;
      }
      currentImgWidth.value = resData.data.img_width;
      currentImgHeight.value = resData.data.img_height;
      fps.value = resData.data.fps;
      videoStreamSessionId.value = resData.data.session_id;
      videoDetecting.value = true;
      startStreamStatsPolling(resData.data.stats_url);
      activeView.value = 'monitor';
      ElMessage.success('后端视频分析已完成');
    } catch {
      ElMessage.error('视频分析启动失败，请确认后端服务已启动');
    } finally {
      loading.value = false;
    }
  };

  const startStreamStatsPolling = (statsUrl) => {
    if (streamStatsTimer.value !== null) {
      window.clearInterval(streamStatsTimer.value);
      streamStatsTimer.value = null;
    }

    const loadStats = async () => {
      try {
        const response = await axios.get(toApiUrl(statsUrl), {
          params: { afterFrame: lastReceivedFrame.value },
        });
        const resData = response.data;
        if (resData.status !== 'success') return;

        const stats = resData.data;
        const receivedFrameCount = stats.frames?.length || 0;
        currentImgWidth.value = stats.img_width;
        currentImgHeight.value = stats.img_height;
        frameCount.value = stats.frame_count;
        fps.value = stats.fps;

        const namedTracks = withDisplayNames(stats.tracks);
        tableData.value = namedTracks;

        const nextCache = { ...detectionFrameCache.value };
        stats.frames?.forEach((frame) => {
          if (frame.frame_count > 0) {
            const frameTracks = withDisplayNames(frame.tracks);
            nextCache[frame.frame_count] = frameTracks;
            recordFlowPoint(frame.frame_count, frameTracks.length);
            lastReceivedFrame.value = Math.max(lastReceivedFrame.value, frame.frame_count);
          }
        });
        if (stats.frame_count > 0 && !nextCache[stats.frame_count]) {
          nextCache[stats.frame_count] = namedTracks;
        }
        detectionFrameCache.value = nextCache;
        videoDetecting.value = stats.running;

        if (!stats.running && receivedFrameCount === 0 && streamStatsTimer.value !== null) {
          window.clearInterval(streamStatsTimer.value);
          streamStatsTimer.value = null;
        }
      } catch (error) {
        console.warn('stats polling failed', error);
      }
    };

    void loadStats();
    streamStatsTimer.value = window.setInterval(loadStats, 160);
  };

  const stopBackendVideoStream = () => {
    if (streamStatsTimer.value !== null) {
      window.clearInterval(streamStatsTimer.value);
      streamStatsTimer.value = null;
    }
    const sessionId = videoStreamSessionId.value;
    videoStreamSessionId.value = '';
    detectionFrameCache.value = {};
    lastReceivedFrame.value = 0;
    videoDetecting.value = false;
    if (sessionId) {
      void axios.post(`${API_BASE}/api/stream/${sessionId}/stop`).catch(() => undefined);
    }
  };

  const toApiUrl = (path) => {
    return path.startsWith('http') ? path : `${API_BASE}${path}`;
  };

  const requestDetect = async (formData, options = {}) => {
    try {
      const response = await axios.post(`${API_BASE}/api/detect`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const resData = response.data;
      if (resData.status !== 'success') {
        if (!options.silent) ElMessage.error(resData.message || '检测失败');
        return;
      }

      currentImgWidth.value = resData.data.img_width;
      currentImgHeight.value = resData.data.img_height;
      tableData.value = withDisplayNames(resData.data.detections);
      recordFlowPoint(1, tableData.value.length);
    } catch {
      if (!options.silent) ElMessage.error('图片检测失败，请确认后端服务已启动');
    }
  };

  return {
    uploadMedia,
    reAnalyze,
    handleVideoTimeUpdate,
    handleVideoPlay,
    handleVideoEnded,
    stopBackendVideoStream,
  };
}
