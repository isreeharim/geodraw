import { GPSPoint } from '@/types';
import { calculateBearing } from '../..//lib/geo/calculations';
import * as turf from '@turf/turf';

export type InterpolatedFrame = {
  currentPoint: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  heading: number;
  progress: number;
  drawnDistanceMeters: number;
  lineGeometry: GeoJSON.LineString | GeoJSON.MultiLineString | null;
  vehiclePoint: GeoJSON.Feature<GeoJSON.Point>;
};

/**
 * Reconstructs continuous position, heading, and partial route geometry at normalized progress p in [0, 1].
 */
export function interpolateTrackAtProgress(
  points: GPSPoint[],
  progress: number
): InterpolatedFrame | null {
  if (!points || points.length === 0) return null;

  const clampedProgress = Math.max(0, Math.min(1, progress));

  if (points.length === 1) {
    const pt = points[0];
    return {
      currentPoint: { latitude: pt.latitude, longitude: pt.longitude, timestamp: pt.timestamp },
      heading: pt.heading ?? 0,
      progress: clampedProgress,
      drawnDistanceMeters: 0,
      lineGeometry: null,
      vehiclePoint: turf.point([pt.longitude, pt.latitude]),
    };
  }

  const startTime = points[0].timestamp;
  const endTime = points[points.length - 1].timestamp;
  const totalDuration = endTime - startTime;

  const targetTime = startTime + totalDuration * clampedProgress;

  // Find surrounding points
  let lowerIdx = 0;
  let upperIdx = points.length - 1;

  for (let i = 0; i < points.length - 1; i++) {
    if (targetTime >= points[i].timestamp && targetTime <= points[i + 1].timestamp) {
      lowerIdx = i;
      upperIdx = i + 1;
      break;
    }
  }

  const p1 = points[lowerIdx];
  const p2 = points[upperIdx];

  const timeDiff = p2.timestamp - p1.timestamp;
  const alpha = timeDiff > 0 ? (targetTime - p1.timestamp) / timeDiff : 0;

  const currentLat = p1.latitude + alpha * (p2.latitude - p1.latitude);
  const currentLng = p1.longitude + alpha * (p2.longitude - p1.longitude);

  const heading =
    calculateBearing(p1, p2) ??
    p1.heading ??
    0;

  // Build partial line geometry up to the current interpolated point
  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [];
  let currentSegIndex = points[0].segment;
  let drawnDistance = 0;

  for (let i = 0; i <= lowerIdx; i++) {
    const pt = points[i];
    if (pt.segment !== currentSegIndex) {
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      currentSegIndex = pt.segment;
    }

    if (i > 0 && points[i - 1].segment === pt.segment) {
      const from = turf.point([points[i - 1].longitude, points[i - 1].latitude]);
      const to = turf.point([pt.longitude, pt.latitude]);
      drawnDistance += turf.distance(from, to, { units: 'meters' });
    }

    currentSegment.push([pt.longitude, pt.latitude]);
  }

  // Append current interpolated point if in the same segment
  if (p2.segment === p1.segment) {
    const from = turf.point([p1.longitude, p1.latitude]);
    const to = turf.point([currentLng, currentLat]);
    drawnDistance += turf.distance(from, to, { units: 'meters' });
    currentSegment.push([currentLng, currentLat]);
  }

  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  let lineGeometry: GeoJSON.LineString | GeoJSON.MultiLineString | null = null;
  if (segments.length === 1) {
    lineGeometry = {
      type: 'LineString',
      coordinates: segments[0],
    };
  } else if (segments.length > 1) {
    lineGeometry = {
      type: 'MultiLineString',
      coordinates: segments,
    };
  }

  return {
    currentPoint: {
      latitude: currentLat,
      longitude: currentLng,
      timestamp: targetTime,
    },
    heading,
    progress: clampedProgress,
    drawnDistanceMeters: drawnDistance,
    lineGeometry,
    vehiclePoint: turf.point([currentLng, currentLat], { heading }),
  };
}
