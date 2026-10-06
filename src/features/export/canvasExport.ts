import { Journey } from '@/types';

export type CardExportOptions = {
  width?: number;
  height?: number;
  theme?: 'dark' | 'light';
};

/**
 * Renders a high-resolution, shareable Journey Card on a canvas and returns a PNG data URL.
 */
export async function generateJourneyCard(
  journey: Journey,
  options: CardExportOptions = {}
): Promise<string> {
  const width = options.width || 1080;
  const height = options.height || 1350; // 4:5 Instagram / social portrait ratio
  const isDark = options.theme !== 'light';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // 1. Background
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  if (isDark) {
    bgGradient.addColorStop(0, '#0f172a'); // slate-900
    bgGradient.addColorStop(1, '#020617'); // slate-950
  } else {
    bgGradient.addColorStop(0, '#f8fafc');
    bgGradient.addColorStop(1, '#e2e8f0');
  }
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Card Container / Glow
  const margin = 60;
  const cardWidth = width - margin * 2;
  const cardHeight = height - margin * 2;

  ctx.save();
  ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;

  // Rounded rectangle
  const radius = 32;
  ctx.beginPath();
  ctx.moveTo(margin + radius, margin);
  ctx.lineTo(margin + cardWidth - radius, margin);
  ctx.quadraticCurveTo(margin + cardWidth, margin, margin + cardWidth, margin + radius);
  ctx.lineTo(margin + cardWidth, margin + cardHeight - radius);
  ctx.quadraticCurveTo(margin + cardWidth, margin + cardHeight, margin + cardWidth - radius, margin + cardHeight);
  ctx.lineTo(margin + radius, margin + cardHeight);
  ctx.quadraticCurveTo(margin, margin + cardHeight, margin, margin + cardHeight - radius);
  ctx.lineTo(margin, margin + radius);
  ctx.quadraticCurveTo(margin, margin, margin + radius, margin);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 3. Header Section (Title, Mode, Date)
  const contentX = margin + 50;
  let cursorY = margin + 80;

  // Brand Pill
  ctx.fillStyle = '#ff4d4f';
  ctx.beginPath();
  ctx.arc(contentX + 12, cursorY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ff4d4f';
  ctx.fillText('GEODRAW', contentX + 28, cursorY + 7);

  const dateStr = new Date(journey.started_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, margin + cardWidth - 50, cursorY + 7);
  ctx.textAlign = 'left';

  // Title
  cursorY += 70;
  ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
  const displayTitle = journey.title.length > 28 ? journey.title.substring(0, 26) + '...' : journey.title;
  ctx.fillText(displayTitle, contentX, cursorY);

  // 4. Metrics Grid
  cursorY += 60;
  const metricsBoxY = cursorY;
  const colWidth = (cardWidth - 100) / 3;

  const distanceKm = (journey.distance_m / 1000).toFixed(2);
  const minutes = Math.floor(journey.duration_s / 60);
  const seconds = Math.floor(journey.duration_s % 60);
  const durationStr = `${minutes}m ${seconds}s`;
  const avgSpeedKmh =
    journey.duration_s > 0 ? ((journey.distance_m / 1000) / (journey.duration_s / 3600)).toFixed(1) : '0';

  const metrics = [
    { label: 'DISTANCE', val: `${distanceKm} km` },
    { label: 'DURATION', val: durationStr },
    { label: 'AVG SPEED', val: `${avgSpeedKmh} km/h` },
  ];

  metrics.forEach((m, idx) => {
    const x = contentX + idx * colWidth;
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.fillText(m.label, x, metricsBoxY);

    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
    ctx.fillText(m.val, x, metricsBoxY + 45);
  });

  // 5. Route Path Preview Rendering
  cursorY = metricsBoxY + 90;
  const routeAreaHeight = margin + cardHeight - cursorY - 90;
  const routeAreaWidth = cardWidth - 100;

  // Background for route map area
  ctx.fillStyle = isDark ? '#0f172a' : '#f1f5f9';
  ctx.beginPath();
  const mapRadius = 20;
  ctx.roundRect?.(contentX, cursorY, routeAreaWidth, routeAreaHeight, mapRadius);
  ctx.fill();

  // Draw scaled route lines from raw_track
  if (journey.raw_track && journey.raw_track.length > 1) {
    const lats = journey.raw_track.map((p) => p.latitude);
    const lngs = journey.raw_track.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lngSpan = Math.max(0.0001, maxLng - minLng);

    const padding = 50;
    const drawW = routeAreaWidth - padding * 2;
    const drawH = routeAreaHeight - padding * 2;

    const scale = Math.min(drawW / lngSpan, drawH / latSpan);
    const offsetX = contentX + padding + (drawW - lngSpan * scale) / 2;
    const offsetY = cursorY + padding + (drawH - latSpan * scale) / 2;

    ctx.save();
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    journey.raw_track.forEach((pt, i) => {
      const x = offsetX + (pt.longitude - minLng) * scale;
      // Invert Y because latitude goes upwards
      const y = offsetY + (maxLat - pt.latitude) * scale;

      if (i === 0 || pt.segment !== journey.raw_track[i - 1].segment) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Start & End markers
    const startPt = journey.raw_track[0];
    const endPt = journey.raw_track[journey.raw_track.length - 1];

    const startX = offsetX + (startPt.longitude - minLng) * scale;
    const startY = offsetY + (maxLat - startPt.latitude) * scale;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(startX, startY, 8, 0, Math.PI * 2);
    ctx.fill();

    const endX = offsetX + (endPt.longitude - minLng) * scale;
    const endY = offsetY + (maxLat - endPt.latitude) * scale;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(endX, endY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 6. Attribution Footer
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Created with GeoDraw • Map data © OpenStreetMap contributors',
    width / 2,
    margin + cardHeight - 35
  );

  return canvas.toDataURL('image/png');
}

/**
 * Checks client browser video recording capability.
 */
export function checkVideoSupport(): {
  supported: boolean;
  mimeType: string | null;
} {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { supported: false, mimeType: null };
  }

  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];

  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return { supported: true, mimeType: t };
    }
  }

  return { supported: false, mimeType: null };
}
