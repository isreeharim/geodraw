import { GPSPoint } from '@/types';
import * as turf from '@turf/turf';

export type ParsedGpxResult = {
  title: string;
  points: GPSPoint[];
};

export function parseGpx(gpxString: string): ParsedGpxResult {
  let title = 'Imported Journey';

  // Extract title if available
  const nameMatch = gpxString.match(/<name>(.*?)<\/name>/i);
  if (nameMatch && nameMatch[1]) {
    title = nameMatch[1].trim();
  }

  const points: GPSPoint[] = [];

  // Split into segments via <trkseg> tags if present
  const trksegRegex = /<trkseg>([\s\S]*?)<\/trkseg>/gi;
  let segMatch: RegExpExecArray | null;
  let segmentIndex = 0;
  let hasSegments = false;

  const parseTrkptList = (content: string, seg: number) => {
    const trkptRegex = /<trkpt\s+lat=["']([^"']+)["']\s+lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>|<trkpt\s+lat=["']([^"']+)["']\s+lon=["']([^"']+)["']\s*\/>/gi;
    let ptMatch: RegExpExecArray | null;

    while ((ptMatch = trkptRegex.exec(content)) !== null) {
      const lat = parseFloat(ptMatch[1] ?? ptMatch[4]);
      const lon = parseFloat(ptMatch[2] ?? ptMatch[5]);
      const inner = ptMatch[3] ?? '';

      if (isNaN(lat) || isNaN(lon)) continue;

      let ele: number | null = null;
      const eleMatch = inner.match(/<ele>(.*?)<\/ele>/i);
      if (eleMatch && eleMatch[1]) {
        const parsedEle = parseFloat(eleMatch[1]);
        if (!isNaN(parsedEle)) ele = parsedEle;
      }

      let timestamp: number | null = null;
      const timeMatch = inner.match(/<time>(.*?)<\/time>/i);
      if (timeMatch && timeMatch[1]) {
        const parsedTime = new Date(timeMatch[1].trim()).getTime();
        if (!isNaN(parsedTime) && parsedTime > 0) timestamp = parsedTime;
      }

      points.push({
        latitude: lat,
        longitude: lon,
        altitude: ele,
        accuracy: null,
        speed: null,
        heading: null,
        timestamp: timestamp ?? 0,
        segment: seg,
      });
    }
  };

  while ((segMatch = trksegRegex.exec(gpxString)) !== null) {
    hasSegments = true;
    parseTrkptList(segMatch[1], segmentIndex);
    segmentIndex++;
  }

  // Fallback if no <trkseg> was matched
  if (!hasSegments) {
    parseTrkptList(gpxString, 0);
  }

  // If points have missing or non-monotonic timestamps, synthesize them realistically
  if (points.length > 0) {
    let needsSynth = false;
    for (let i = 0; i < points.length; i++) {
      if (points[i].timestamp === 0 || (i > 0 && points[i].timestamp <= points[i - 1].timestamp)) {
        needsSynth = true;
        break;
      }
    }

    if (needsSynth) {
      const baseTime = points[0].timestamp > 0 ? points[0].timestamp : Date.now();
      let accumulatedTime = baseTime;
      points[0].timestamp = accumulatedTime;

      // Assume an average pace of ~10 km/h (2.77 m/s) to synthesize smooth intervals
      const defaultSpeedMs = 2.77;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        const from = turf.point([prev.longitude, prev.latitude]);
        const to = turf.point([curr.longitude, curr.latitude]);
        const distM = turf.distance(from, to, { units: 'meters' });

        const dtMs = Math.max(1000, Math.round((distM / defaultSpeedMs) * 1000));
        accumulatedTime += dtMs;
        curr.timestamp = accumulatedTime;
      }
    }
  }

  return {
    title,
    points,
  };
}
