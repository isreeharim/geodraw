import { GPSPoint, Journey, JourneyPublic } from '@/types';
import * as turf from '@turf/turf';
import { simplifyTrack } from '@/lib/geo/calculations';

/**
 * Generates an unguessable cryptographic token for unlisted sharing (>= 128-bit).
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(20); // 160 bits
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Trims the first and last N meters of a GPS track to protect sensitive
 * origin and destination locations (e.g. home, office).
 */
export function trimPrivacyEndpoints(
  points: GPSPoint[],
  trimDistanceMeters: number = 200
): GPSPoint[] {
  if (points.length < 4) return points;

  // 1. Trim start
  let startIdx = 0;
  let accumulatedStartDist = 0;

  for (let i = 1; i < points.length; i++) {
    const from = turf.point([points[i - 1].longitude, points[i - 1].latitude]);
    const to = turf.point([points[i].longitude, points[i].latitude]);
    accumulatedStartDist += turf.distance(from, to, { units: 'meters' });

    if (accumulatedStartDist >= trimDistanceMeters) {
      startIdx = i;
      break;
    }
  }

  // 2. Trim end
  let endIdx = points.length - 1;
  let accumulatedEndDist = 0;

  for (let i = points.length - 2; i >= 0; i--) {
    const from = turf.point([points[i + 1].longitude, points[i + 1].latitude]);
    const to = turf.point([points[i].longitude, points[i].latitude]);
    accumulatedEndDist += turf.distance(from, to, { units: 'meters' });

    if (accumulatedEndDist >= trimDistanceMeters) {
      endIdx = i;
      break;
    }
  }

  if (startIdx >= endIdx) {
    // If the entire journey is shorter than the combined trim radius, return the center point(s)
    const mid = Math.floor(points.length / 2);
    return points.slice(Math.max(0, mid - 1), Math.min(points.length, mid + 2));
  }

  return points.slice(startIdx, endIdx + 1);
}

/**
 * Creates a public, privacy-sanitized JourneyPublic payload.
 * - Trims first and last N meters
 * - Derives simplified geometry
 * - Drops raw coordinate array and sensitive metadata
 */
export function createPublicJourneyPayload(
  journey: Journey,
  trimMeters: number = 200
): JourneyPublic {
  const shareToken = journey.share_token || generateShareToken();
  const sanitizedPoints = trimPrivacyEndpoints(journey.raw_track, trimMeters);
  const displayGeometry = simplifyTrack(sanitizedPoints) || {
    type: 'LineString',
    coordinates: sanitizedPoints.map((p) => [p.longitude, p.latitude]),
  };

  return {
    journey_id: journey.id,
    share_token: shareToken,
    title: journey.title,
    distance_m: journey.distance_m,
    duration_s: journey.duration_s,
    travel_mode: journey.travel_mode,
    vehicle: journey.vehicle,
    started_at: journey.started_at,
    display_geometry: displayGeometry,
    style: journey.style,
  };
}
