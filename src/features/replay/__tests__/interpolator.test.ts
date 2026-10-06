import { describe, it, expect } from 'vitest';
import { interpolateTrackAtProgress } from '../interpolator';
import { GPSPoint } from '@/types';

describe('Replay Interpolator', () => {
  const points: GPSPoint[] = [
    {
      latitude: 10,
      longitude: 20,
      altitude: null,
      accuracy: 5,
      speed: 1,
      heading: 0,
      timestamp: 1000,
      segment: 0,
    },
    {
      latitude: 10,
      longitude: 22,
      altitude: null,
      accuracy: 5,
      speed: 1,
      heading: 90,
      timestamp: 3000,
      segment: 0,
    },
    {
      latitude: 12,
      longitude: 22,
      altitude: null,
      accuracy: 5,
      speed: 1,
      heading: 0,
      timestamp: 5000,
      segment: 0,
    },
  ];

  it('interpolates point accurately at 0%, 50%, and 100%', () => {
    const at0 = interpolateTrackAtProgress(points, 0);
    expect(at0?.currentPoint.latitude).toBe(10);
    expect(at0?.currentPoint.longitude).toBe(20);

    // 50% time: between 1000 and 5000 is 3000 ms, which is exactly point 1
    const at50 = interpolateTrackAtProgress(points, 0.5);
    expect(at50?.currentPoint.latitude).toBe(10);
    expect(at50?.currentPoint.longitude).toBe(22);

    // 100%
    const at100 = interpolateTrackAtProgress(points, 1.0);
    expect(at100?.currentPoint.latitude).toBe(12);
    expect(at100?.currentPoint.longitude).toBe(22);
  });

  it('interpolates intermediate coordinates at 25%', () => {
    // 25% of 4000ms is 1000ms offset -> timestamp 2000ms (halfway between pt0 and pt1)
    const at25 = interpolateTrackAtProgress(points, 0.25);
    expect(at25?.currentPoint.latitude).toBe(10);
    expect(at25?.currentPoint.longitude).toBe(21);
    expect(at25?.heading).toBeCloseTo(90, 0);
  });
});
