import { describe, it, expect } from 'vitest';
import { parseGpx } from '../gpx';

describe('GPX Parser', () => {
  const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoDraw Tests">
  <metadata>
    <name>Morning Run in SF</name>
  </metadata>
  <trk>
    <name>Morning Run in SF</name>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194">
        <ele>15.2</ele>
        <time>2026-10-06T08:00:00Z</time>
      </trkpt>
      <trkpt lat="37.7755" lon="-122.4180">
        <ele>16.0</ele>
        <time>2026-10-06T08:00:30Z</time>
      </trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="37.7760" lon="-122.4170">
        <ele>16.5</ele>
        <time>2026-10-06T08:02:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

  it('parses track points, segments, elevation, timestamps, and title correctly', () => {
    const result = parseGpx(sampleGpx);
    expect(result.title).toBe('Morning Run in SF');
    expect(result.points.length).toBe(3);

    // Segment 0
    expect(result.points[0].latitude).toBe(37.7749);
    expect(result.points[0].longitude).toBe(-122.4194);
    expect(result.points[0].altitude).toBe(15.2);
    expect(result.points[0].segment).toBe(0);
    expect(result.points[0].timestamp).toBe(new Date('2026-10-06T08:00:00Z').getTime());

    // Segment 1 (from second trkseg)
    expect(result.points[2].segment).toBe(1);
  });

  it('handles GPX without timestamps by synthesizing monotonic timestamps', () => {
    const noTimeGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194"></trkpt>
      <trkpt lat="37.7755" lon="-122.4180"></trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const result = parseGpx(noTimeGpx);
    expect(result.points.length).toBe(2);
    expect(result.points[0].timestamp).toBeLessThan(result.points[1].timestamp);
  });
});
