import { describe, it, expect } from 'vitest';
import { validatePoint, calculateDistance, filterJitter } from '../calculations';
import { GPSPoint } from '@/types';

describe('GPS validation and calculations', () => {
  const basePoint: GPSPoint = {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    accuracy: 5,
    speed: 1.2,
    heading: 90,
    timestamp: 1700000000000,
    segment: 0,
  };

  it('validates a correct GPS point within bounds and accuracy', () => {
    const result = validatePoint(basePoint, null, 'walk', 50);
    expect(result.valid).toBe(true);
  });

  it('rejects points with invalid coordinates', () => {
    const badLat: GPSPoint = { ...basePoint, latitude: 95.0 };
    expect(validatePoint(badLat, null, 'walk').valid).toBe(false);

    const badLng: GPSPoint = { ...basePoint, longitude: -190.0 };
    expect(validatePoint(badLng, null, 'walk').valid).toBe(false);
  });

  it('rejects points with accuracy worse than threshold', () => {
    const badAccuracy: GPSPoint = { ...basePoint, accuracy: 75 };
    const res = validatePoint(badAccuracy, null, 'walk', 50);
    expect(res.valid).toBe(false);
    expect(res.reason?.toLowerCase()).toContain('accuracy');
  });

  it('rejects non-monotonic timestamps', () => {
    const prevPoint: GPSPoint = { ...basePoint, timestamp: 1700000005000 };
    const currentPoint: GPSPoint = { ...basePoint, timestamp: 1700000004000 };
    const res = validatePoint(currentPoint, prevPoint, 'walk');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('timestamp');
  });

  it('rejects implausible speed for walk mode (> 15 km/h)', () => {
    // 1 km in 5 seconds = 720 km/h
    const prevPoint: GPSPoint = { ...basePoint, timestamp: 1700000000000 };
    const fastPoint: GPSPoint = {
      ...basePoint,
      latitude: 37.7849, // ~1.1 km away
      timestamp: 1700000005000,
    };
    const res = validatePoint(fastPoint, prevPoint, 'walk');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('speed');
  });

  it('calculates segment-aware distance without counting gaps between segments', () => {
    const p1: GPSPoint = { ...basePoint, segment: 0, timestamp: 1000 };
    const p2: GPSPoint = { ...basePoint, latitude: 37.7849, segment: 0, timestamp: 2000 };
    const p3: GPSPoint = { ...basePoint, latitude: 37.7949, segment: 1, timestamp: 5000 }; // New segment (paused & moved)
    const p4: GPSPoint = { ...basePoint, latitude: 37.8049, segment: 1, timestamp: 6000 };

    const dist1 = calculateDistance([p1, p2]);
    const distAll = calculateDistance([p1, p2, p3, p4]);

    const seg2Dist = calculateDistance([p3, p4]);
    // distAll should be dist(p1, p2) + dist(p3, p4), NOT including jump p2 -> p3
    expect(Math.round(distAll)).toBe(Math.round(dist1 + seg2Dist));
  });

  it('suppresses stationary jitter', () => {
    const stationary1: GPSPoint = { ...basePoint, timestamp: 1000 };
    // Moved 0.5 meters in 1 second while stationary
    const stationary2: GPSPoint = {
      ...basePoint,
      latitude: 37.774902,
      timestamp: 2000,
      speed: 0.1,
    };
    const isJitter = filterJitter(stationary2, stationary1, 2); // 2 meter threshold
    expect(isJitter).toBe(true);
  });
});
