import { GPSPoint, TravelMode } from '@/types';
import * as turf from '@turf/turf';

export const MODE_SPEED_LIMITS_KMH: Record<TravelMode, number> = {
  walk: 15,
  bike: 40,
  car: 200,
  plane: 1000,
};

export type ValidationResult = {
  valid: boolean;
  reason?: string;
};

/**
 * Validates a GPS point against geographical bounds, accuracy thresholds,
 * monotonicity, and mode-dependent speed plausibility.
 */
export function validatePoint(
  point: GPSPoint,
  prevPoint: GPSPoint | null = null,
  mode: TravelMode = 'walk',
  maxAccuracyThresholdMeters: number = 50
): ValidationResult {
  // 1. Latitude / Longitude validity
  if (
    typeof point.latitude !== 'number' ||
    typeof point.longitude !== 'number' ||
    isNaN(point.latitude) ||
    isNaN(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    return { valid: false, reason: 'Invalid coordinates' };
  }

  // 2. Timestamp validity
  if (!point.timestamp || isNaN(point.timestamp) || point.timestamp <= 0) {
    return { valid: false, reason: 'Invalid timestamp' };
  }

  // 3. Accuracy threshold
  if (
    point.accuracy !== null &&
    point.accuracy !== undefined &&
    point.accuracy > maxAccuracyThresholdMeters
  ) {
    return {
      valid: false,
      reason: `Accuracy (${point.accuracy.toFixed(1)}m) worse than threshold (${maxAccuracyThresholdMeters}m)`,
    };
  }

  // 4. Time monotonicity & speed checks relative to previous point
  if (prevPoint) {
    if (point.timestamp <= prevPoint.timestamp) {
      return { valid: false, reason: 'Non-monotonic timestamp' };
    }

    // Only compute speed jump if we are within the same segment
    if (point.segment === prevPoint.segment) {
      const from = turf.point([prevPoint.longitude, prevPoint.latitude]);
      const to = turf.point([point.longitude, point.latitude]);
      const distanceKm = turf.distance(from, to, { units: 'kilometers' });
      const elapsedHours = (point.timestamp - prevPoint.timestamp) / 3600000;

      if (elapsedHours > 0) {
        const impliedSpeedKmh = distanceKm / elapsedHours;
        const maxSpeedKmh = MODE_SPEED_LIMITS_KMH[mode] || 100;

        if (impliedSpeedKmh > maxSpeedKmh) {
          return {
            valid: false,
            reason: `Implied speed (${impliedSpeedKmh.toFixed(1)} km/h) exceeds ${mode} limit (${maxSpeedKmh} km/h)`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Calculates total cumulative distance in meters across segments.
 * Gaps between different segments are never counted.
 */
export function calculateDistance(points: GPSPoint[]): number {
  if (points.length < 2) return 0;

  let totalDistanceMeters = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Gaps between segments are never counted
    if (curr.segment === prev.segment) {
      const from = turf.point([prev.longitude, prev.latitude]);
      const to = turf.point([curr.longitude, curr.latitude]);
      const distM = turf.distance(from, to, { units: 'meters' });
      totalDistanceMeters += distM;
    }
  }

  return totalDistanceMeters;
}

/**
 * Detects whether the current point is stationary jitter.
 * Returns true if the movement is below threshold and speed is negligible.
 */
export function filterJitter(
  current: GPSPoint,
  previous: GPSPoint | null,
  minRadiusMeters: number = 2.5
): boolean {
  if (!previous) return false;
  if (current.segment !== previous.segment) return false;

  const from = turf.point([previous.longitude, previous.latitude]);
  const to = turf.point([current.longitude, current.latitude]);
  const distM = turf.distance(from, to, { units: 'meters' });

  // If distance is within jitter radius and speed is very low (< 0.5 m/s or 1.8 km/h)
  const isLowSpeed = current.speed === null || current.speed < 0.5;
  if (distM < minRadiusMeters && isLowSpeed) {
    return true;
  }

  return false;
}

/**
 * Calculates bearing (heading) in degrees (0 to 360) between two points.
 */
export function calculateBearing(from: GPSPoint, to: GPSPoint): number {
  const p1 = turf.point([from.longitude, from.latitude]);
  const p2 = turf.point([to.longitude, to.latitude]);
  const rawBearing = turf.bearing(p1, p2);
  return (rawBearing + 360) % 360;
}

/**
 * Converts GPS points to a GeoJSON MultiLineString or LineString,
 * respecting segment boundaries, and simplifies the geometry
 * using Douglas–Peucker for display.
 */
export function simplifyTrack(
  points: GPSPoint[],
  tolerance: number = 0.00005
): GeoJSON.MultiLineString | GeoJSON.LineString | null {
  if (points.length < 2) return null;

  // Group into continuous segments
  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [];
  let currentSegIndex = points[0].segment;

  for (const pt of points) {
    if (pt.segment !== currentSegIndex) {
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      currentSegIndex = pt.segment;
    }
    currentSegment.push([pt.longitude, pt.latitude]);
  }

  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  if (segments.length === 0) return null;

  if (segments.length === 1) {
    const line = turf.lineString(segments[0]);
    const simplified = turf.simplify(line, { tolerance, highQuality: true });
    return simplified.geometry as GeoJSON.LineString;
  }

  const multiLine = turf.multiLineString(segments);
  const simplified = turf.simplify(multiLine, { tolerance, highQuality: true });
  return simplified.geometry as GeoJSON.MultiLineString;
}

/**
 * Light smoothing for GPS coordinates with high jitter or lower accuracy.
 */
export function smoothPoints(points: GPSPoint[], windowSize: number = 3): GPSPoint[] {
  if (points.length <= windowSize) return points;

  return points.map((pt, idx) => {
    // Only smooth if we have neighboring points in the same segment
    const start = Math.max(0, idx - Math.floor(windowSize / 2));
    const end = Math.min(points.length, idx + Math.ceil(windowSize / 2));
    const window = points.slice(start, end).filter((p) => p.segment === pt.segment);

    if (window.length < 2) return pt;

    const avgLat = window.reduce((sum, p) => sum + p.latitude, 0) / window.length;
    const avgLng = window.reduce((sum, p) => sum + p.longitude, 0) / window.length;

    return {
      ...pt,
      latitude: avgLat,
      longitude: avgLng,
    };
  });
}
