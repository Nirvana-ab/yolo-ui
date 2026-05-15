import { computed } from 'vue';
import {
  FLOW_BUCKET_SECONDS,
  MAX_REASONABLE_SPEED_KMH,
  PERSON_KEYWORDS,
  TARGET_COLORS,
  TRACKABLE_KEYWORDS,
  VEHICLE_KEYWORDS,
} from '../constants/traffic';

export function useTrafficAnalysis(state) {
  const {
    tableData,
    detectionFrameCache,
    flowHistory,
    videoDetecting,
    confThreshold,
    currentImgWidth,
    currentImgHeight,
    frameCount,
    fps,
    currentVideoTime,
    videoEnded,
    classMode,
    metersPerPixel,
    speedLineA,
    speedLineB,
    lineDistanceMeters,
    mediaType,
  } = state;

  const targetStats = computed(() => {    //
    const stats = {};
    filteredTableData.value.forEach((item) => {
      const label = getTargetLabel(item.class_name);
      stats[label] = (stats[label] || 0) + 1;
    });
    return stats;
  });     //遍历筛选后的检测表格数据，把每个检测目标的类别名称取出来，
          // 并统计每一类目标的数量，最后生成一个类别数量统计对象。
  const filteredTableData = computed(() => filterDisplayItems(activeDetectionData.value));
  const displayedDetections = computed(() => filteredTableData.value);

  const activeDetectionData = computed(() => {
    if (mediaType.value !== 'video') return tableData.value;
    return getSyncedVideoDetections();
  });

  const currentVideoFrame = computed(() => {
    return Math.max(1, Math.round(currentVideoTime.value * (fps.value || 25)) + 1);
  });

  const flowFrameCount = computed(() => (mediaType.value === 'video' ? currentVideoFrame.value : frameCount.value || 1));
  const pedestrianCount = computed(() => filteredTableData.value.filter((item) => isPedestrian(item.class_name)).length);
  const vehicleCount = computed(() => filteredTableData.value.filter((item) => isVehicle(item.class_name)).length);
  const vehicleFlowCount = computed(() => filterVehicleFlowItems(activeDetectionData.value).length);

  const flowInsight = computed(() => {
    if (mediaType.value === 'video' && videoEnded.value) {
      return `视频已结束，当前停留帧识别到 ${filteredTableData.value.length} 个目标。拖动进度条可查看已分析帧的检测结果。`;
    }
    if (mediaType.value === 'video' && videoDetecting.value) {
      return `后端正在分析视频，当前播放帧附近识别到 ${filteredTableData.value.length} 个目标。`;
    }
    if (filteredTableData.value.length === 0) return '当前画面暂无可用于统计的行人或车辆目标。';
    const regions = regionStats.value.map((region) => `${region.name}${region.count}`).join('，');
    return `已识别 ${filteredTableData.value.length} 个目标，其中行人 ${pedestrianCount.value} 个、车辆 ${vehicleCount.value} 辆。区域分布：${regions}。`;
  });

  const classDistribution = computed(() => {
    const entries = Object.entries(targetStats.value);
    const max = Math.max(...entries.map(([, count]) => count), 1);
    return entries.map(([name, count]) => ({
      name,
      count,
      percent: Math.max(8, (count / max) * 100),
    }));
  });

  const regionStats = computed(() => {
    const regions = [
      { name: '近景区域', min: 66, max: 101, count: 0 },
      { name: '中景区域', min: 34, max: 66, count: 0 },
      { name: '远景区域', min: 0, max: 34, count: 0 },
    ];
    filteredTableData.value.forEach((item) => {
      const center = getCenterPercent(item.bbox);
      const region = regions.find((candidate) => center.y >= candidate.min && center.y < candidate.max);
      if (region) region.count++;
    });
    const max = Math.max(...regions.map((region) => region.count), 1);
    const total = Math.max(filteredTableData.value.length, 1);
    return regions.map((region) => ({
      ...region,
      percent: Math.max(8, (region.count / max) * 100),
      percentLabel: `${((region.count / total) * 100).toFixed(1)}%`,
    }));
  });

  const speedRecords = computed(() => {
    return filteredTableData.value.map((item, index) => {
      const estimate = getSpeedEstimate(item);
      return {
        name:
          item.track_id !== undefined
            ? `${getTargetLabel(item.class_name)} #${item.track_id}`
            : item.display_name || `${getTargetLabel(item.class_name)} ${index + 1}`,
        direction: item.direction || '--',
        speed: formatSpeedEstimate(estimate),
        method: estimate.method,
      };
    });
  });

  const averageSpeedText = computed(() => {
    const speeds = activeDetectionData.value
      .filter((item) => passesConfidenceThreshold(item) && isVehicle(item.class_name) && isNearRegionTarget(item))
      .map((item) => getSpeedEstimate(item).kmh)
      .filter((speed) => isPlausibleSpeed(speed));
    if (speeds.length === 0) return '--';
    const avg = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    return `${avg.toFixed(1)}`;
  });

  const speedBuckets = computed(() => {
    const buckets = [
      { label: '0-20', min: 0, max: 20, count: 0 },
      { label: '20-40', min: 20, max: 40, count: 0 },
      { label: '40-60', min: 40, max: 60, count: 0 },
      { label: '60+', min: 60, max: Infinity, count: 0 },
    ];
    filteredTableData.value.forEach((item) => {
      const speed = getSpeedEstimate(item).kmh;
      if (!isPlausibleSpeed(speed)) return;
      const bucket = buckets.find((candidate) => speed >= candidate.min && speed < candidate.max);
      if (bucket) bucket.count++;
    });
    const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
    return buckets.map((bucket) => ({ ...bucket, percent: Math.max(8, (bucket.count / max) * 100) }));
  });

  const flowSeries = computed(() => {
    const cachedFramePoints = Object.entries(detectionFrameCache.value)
      .map(([frame, items]) => ({
        frame: Number(frame),
        count: filterVehicleFlowItems(items).length,
      }))
      .filter((point) => Number.isFinite(point.frame) && point.frame > 0 && point.frame <= flowFrameCount.value)
      .sort((a, b) => a.frame - b.frame);

    if (cachedFramePoints.length === 0) {
      return [
        {
          frame: 0,
          label: '当前',
          count: vehicleFlowCount.value,
          x: 160,
          y: 132 - Math.min(112, vehicleFlowCount.value * 14),
        },
      ];
    }

    const bucketFrames = Math.max(1, Math.round((fps.value || 25) * FLOW_BUCKET_SECONDS));
    const buckets = new Map();
    cachedFramePoints.forEach((point) => {
      const bucketIndex = Math.floor(point.frame / bucketFrames);
      buckets.set(bucketIndex, [...(buckets.get(bucketIndex) || []), point]);
    });

    const aggregated = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .slice(-10)
      .map(([bucketIndex, points]) => {
        const avgCount = points.reduce((sum, point) => sum + point.count, 0) / points.length;
        const seconds = bucketIndex * FLOW_BUCKET_SECONDS;
        const minute = Math.floor(seconds / 60);
        const second = Math.floor(seconds % 60);
        return {
          frame: bucketIndex * bucketFrames,
          label: `${minute}:${second.toString().padStart(2, '0')}`,
          count: Number(avgCount.toFixed(1)),
        };
      });

    const maxCount = Math.max(...aggregated.map((point) => point.count), 1);
    const step = aggregated.length > 1 ? 288 / (aggregated.length - 1) : 0;
    return aggregated.map((point, index) => ({
      ...point,
      x: aggregated.length > 1 ? 16 + index * step : 160,
      y: 132 - (point.count / maxCount) * 112,
    }));
  });

  const flowSeriesPoints = computed(() => flowSeries.value.map((point) => `${point.x},${point.y}`).join(' '));

  const heatmapPoints = computed(() => {
    return filteredTableData.value.map((item, index) => {
      const center = getCenterPercent(item.bbox);
      const confidence = typeof item.confidence === 'number' ? item.confidence : 0.6;
      const size = 34 + Math.min(46, confidence * 46);
      const color = TARGET_COLORS[index % TARGET_COLORS.length];
      return {
        id: getDetectionKey(item, index),
        style: {
          left: `${center.x}%`,
          top: `${center.y}%`,
          width: `${size}px`,
          height: `${size}px`,
          background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0.12) 34%, transparent 72%)`,
        },
      };
    });
  });

  const isPedestrian = (className) => {
    const normalized = className.toLowerCase();
    return PERSON_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
  };

  const isVehicle = (className) => {
    const normalized = className.toLowerCase();
    return VEHICLE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
  };

  const isTrackable = (className) => {
    const normalized = className.toLowerCase();
    return TRACKABLE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
  };

  const filterDisplayItems = (items) => {
    const source = items.filter((item) => passesConfidenceThreshold(item));
    if (classMode.value === 'all') return source;
    if (classMode.value === 'vehicle') return source.filter((item) => isVehicle(item.class_name));
    return source.filter((item) => isTrackable(item.class_name));
  };

  const filterVehicleFlowItems = (items) => {
    return items.filter((item) => passesConfidenceThreshold(item) && isVehicle(item.class_name));
  };

  const passesConfidenceThreshold = (item) => {
    return typeof item.confidence !== 'number' || item.confidence >= confThreshold.value;
  };

  const isNearRegionTarget = (item) => {
    if (!Array.isArray(item.bbox)) return false;
    const center = getCenterPercent(item.bbox);
    return center.y >= 66 && center.y < 101;
  };

  const getTargetLabel = (className) => {
    if (isPedestrian(className)) return '行人';
    if (isVehicle(className)) return '车辆';
    return className;
  };

  const getSyncedVideoDetections = () => {
    const videoFps = fps.value || 25;
    const currentFrame = currentVideoFrame.value;
    const availableFrames = Object.keys(detectionFrameCache.value)
      .map(Number)
      .filter((frame) => Number.isFinite(frame))
      .sort((a, b) => a - b);
    if (availableFrames.length === 0) return [];

    const previousFrame = [...availableFrames].reverse().find((frame) => frame <= currentFrame);
    const nextFrame = availableFrames.find((frame) => frame >= currentFrame);
    const maxGap = Math.max(4, Math.round(videoFps * 0.45));
    if (previousFrame === undefined && nextFrame === undefined) return [];

    if (previousFrame !== undefined && nextFrame !== undefined) {
      if (previousFrame === nextFrame) return detectionFrameCache.value[previousFrame] || [];
      if (currentFrame - previousFrame <= maxGap && nextFrame - currentFrame <= maxGap) {
        return interpolateDetections(
          detectionFrameCache.value[previousFrame] || [],
          detectionFrameCache.value[nextFrame] || [],
          (currentFrame - previousFrame) / Math.max(1, nextFrame - previousFrame),
        );
      }
    }

    const nearestFrame = previousFrame ?? nextFrame;
    if (nearestFrame === undefined || Math.abs(nearestFrame - currentFrame) > maxGap) return [];
    return detectionFrameCache.value[nearestFrame] || [];
  };

  const interpolateDetections = (previousItems, nextItems, ratio) => {
    return previousItems.map((previousItem, index) => {
      const nextItem = findMatchingDetection(previousItem, nextItems);
      if (!nextItem) return previousItem;
      const bbox = previousItem.bbox.map((value, bboxIndex) => value + (nextItem.bbox[bboxIndex] - value) * ratio);
      return {
        ...previousItem,
        confidence: previousItem.confidence + (nextItem.confidence - previousItem.confidence) * ratio,
        bbox,
        center: getCenterPixel(bbox),
        display_name: previousItem.display_name || nextItem.display_name || `${getTargetLabel(previousItem.class_name)} ${index + 1}`,
      };
    });
  };

  const findMatchingDetection = (item, candidates) => {
    if (item.track_id !== undefined) {
      const sameTrack = candidates.find((candidate) => candidate.track_id === item.track_id);
      if (sameTrack) return sameTrack;
    }
    const itemCenter = getCenterPixel(item.bbox);
    const sameClassCandidates = candidates.filter((candidate) => getTargetLabel(candidate.class_name) === getTargetLabel(item.class_name));
    let bestCandidate;
    let bestDistance = Number.POSITIVE_INFINITY;
    sameClassCandidates.forEach((candidate) => {
      const candidateCenter = getCenterPixel(candidate.bbox);
      const distance = Math.hypot(candidateCenter.x - itemCenter.x, candidateCenter.y - itemCenter.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCandidate = candidate;
      }
    });
    const maxDistance = Math.max(currentImgWidth.value, currentImgHeight.value) * 0.08;
    return bestDistance <= maxDistance ? bestCandidate : undefined;
  };

  const getCenterPixel = (bbox) => {
    const [x1, y1, x2, y2] = bbox;
    return {
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
    };
  };

  const getCenterPercent = (bbox) => {
    const [x1, y1, x2, y2] = bbox;
    return {
      x: (((x1 + x2) / 2) / (currentImgWidth.value || 1)) * 100,
      y: (((y1 + y2) / 2) / (currentImgHeight.value || 1)) * 100,
    };
  };

  const toKmh = (pixelSpeed) => pixelSpeed * metersPerPixel.value * 3.6;

  const getSpeedEstimate = (item) => {
    const lineSpeed = calcSpeedLineKmh(item);
    if (isPlausibleSpeed(lineSpeed)) return { kmh: lineSpeed, method: '测速线' };

    const pixelSpeed = typeof item.speed === 'number' ? toKmh(item.speed) : null;
    if (isPlausibleSpeed(pixelSpeed)) return { kmh: pixelSpeed, method: '像素标定' };

    return { kmh: null, method: '--' };
  };

  const calcSpeedLineKmh = (item) => {
    if (!Array.isArray(item.history) || item.history.length < 2) return null;

    const frameA = findLineCrossingFrame(item.history, speedLineA.value);
    const frameB = findLineCrossingFrame(item.history, speedLineB.value);
    if (frameA === null || frameB === null) return null;

    const frameDelta = Math.abs(frameB - frameA);
    if (frameDelta < 2) return null;

    const seconds = frameDelta / (fps.value || 25);
    if (seconds <= 0) return null;

    return (lineDistanceMeters.value / seconds) * 3.6;
  };

  const findLineCrossingFrame = (history, linePercent) => {
    const points = history.map((point) => normalizeHistoryPoint(point)).filter((point) => point !== null);

    for (let index = 1; index < points.length; index++) {
      const previous = points[index - 1];
      const current = points[index];
      if (previous.y === linePercent) return previous.frame;
      if (current.y === linePercent) return current.frame;

      const previousOffset = previous.y - linePercent;
      const currentOffset = current.y - linePercent;
      if (previousOffset * currentOffset < 0 && current.y !== previous.y) {
        const ratio = (linePercent - previous.y) / (current.y - previous.y);
        return previous.frame + (current.frame - previous.frame) * ratio;
      }
    }

    return null;
  };

  const normalizeHistoryPoint = (point) => {
    const center = Array.isArray(point.center) ? point.center : null;
    const frame = Number(point.frame_index ?? point.frameIndex);
    if (!center || center.length < 2 || !Number.isFinite(frame)) return null;

    const y = (Number(center[1]) / (currentImgHeight.value || 1)) * 100;
    if (!Number.isFinite(y)) return null;

    return { frame, y };
  };

  const isPlausibleSpeed = (speed) => {
    return typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 && speed <= MAX_REASONABLE_SPEED_KMH;
  };

  const formatSpeedEstimate = (estimate) => {
    if (!isPlausibleSpeed(estimate.kmh)) return '--';
    return `${estimate.kmh.toFixed(1)} km/h`;
  };

  const formatBbox = (bbox) => bbox.map((value) => value.toFixed(0)).join(', ');

  const recordFlowPoint = (frame, count) => {
    if (frame <= 0) return;
    const lastPoint = flowHistory.value[flowHistory.value.length - 1];
    if (lastPoint?.frame === frame) return;
    const seconds = frame / (fps.value || 25);
    const minute = Math.floor(seconds / 60);
    const second = Math.floor(seconds % 60);
    flowHistory.value = [
      ...flowHistory.value,
      {
        frame,
        count,
        label: `${minute}:${second.toString().padStart(2, '0')}`,
      },
    ].slice(-240);
  };

  const withDisplayNames = (items) => {
    const typeCounts = {};
    return items.map((item) => {
      const label = getTargetLabel(item.class_name);
      typeCounts[label] = (typeCounts[label] || 0) + 1;
      return {
        ...item,
        display_name: item.track_id !== undefined ? `${label} #${item.track_id}` : `${label} ${typeCounts[label]}`,
      };
    });
  };

  const getDetectionKey = (item, index) => {
    if (item.track_id !== undefined) return `track-${item.track_id}`;
    return item.display_name || `${item.class_name}-${index}`;
  };

  const getBoxStyle = (bbox) => {
    const [x1, y1, x2, y2] = bbox;
    const width = currentImgWidth.value || 1;
    const height = currentImgHeight.value || 1;
    return {
      left: `${(x1 / width) * 100}%`,
      top: `${(y1 / height) * 100}%`,
      width: `${((x2 - x1) / width) * 100}%`,
      height: `${((y2 - y1) / height) * 100}%`,
    };
  };

  const getCenterStyle = (bbox, color) => {
    const center = getCenterPercent(bbox);
    return {
      left: `${center.x}%`,
      top: `${center.y}%`,
      background: color,
      boxShadow: `0 0 0 2px rgba(255, 255, 255, 0.86), 0 0 8px ${color}`,
    };
  };

  return {
    targetStats,
    filteredTableData,
    displayedDetections,
    activeDetectionData,
    currentVideoFrame,
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
    getSpeedEstimate,
    formatBbox,
    recordFlowPoint,
    withDisplayNames,
    getDetectionKey,
    getBoxStyle,
    getCenterStyle,
  };
}
