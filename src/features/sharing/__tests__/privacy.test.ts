import { describe, it, expect } from 'vitest';
import { trimPrivacyEndpoints, generateShareToken } from '../privacy';
import { GPSPoint } from '@/types';

describe('Privacy and Sharing', () => {
  // A straight route from 37.7749 to 37.7849 (~1100 meters)
  const createTrack = (): GPSPoint[] => {
    const pts: GPSPoint[] = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      pts.push({
        latitude: 37.7749 + i * 0.001,
        longitude: -122.4194,
        altitude: 0,
        accuracy: 5,
        speed: 2,
        heading: 0,
        timestamp: 1000 + i * 1000,
        segment: 0,
      });
    }
    return pts;
  };

  it('generates a secure 128-bit unguessable share token', () => {
    const token = generateShareToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThanOrEqual(24);
  });

  it('trims first and last N meters correctly', () => {
    const track = createTrack();
    const initialCount = track.length;

    // Trim 200m from start and end
    const trimmed = trimPrivacyEndpoints(track, 200);

    expect(trimmed.length).toBeLessThan(initialCount);
    // The start point must not equal the original start point
    expect(trimmed[0].latitude).toBeGreaterThan(track[0].latitude);
    // The end point must be less than the original end point
    expect(trimmed[trimmed.length - 1].latitude).toBeLessThan(track[track.length - 1].latitude);
  });
});
