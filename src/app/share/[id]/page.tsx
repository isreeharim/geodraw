'use client';

import React, { useEffect, useState, use } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Journey, JourneyPublic, ReplaySpeed, CameraMode } from '@/types';
import { db } from '@/lib/storage/db';
import { createClient } from '@/lib/supabase/client';
import { interpolateTrackAtProgress } from '@/features/replay/interpolator';
import { ReplayControls } from '@/components/replay/ReplayControls';
import { ExportModal } from '@/components/replay/ExportModal';
import { ArrowLeft, ShieldCheck, Download, AlertCircle } from 'lucide-react';

const MapView = dynamic(
  () => import('@/components/map/MapView').then((mod) => mod.MapView),
  { ssr: false }
);

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const resolvedParams = use(params);
  const journeyId = resolvedParams.id;

  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Replay State
  const [progress, setProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  useEffect(() => {
    let ignore = false;

    async function loadSharedJourney() {
      try {
        setLoading(true);

        // 1. Try Supabase journey_public table first
        const supabase = createClient();
        if (supabase) {
          const { data, error: sbError } = await supabase
            .from('journey_public')
            .select('*')
            .eq('journey_id', journeyId)
            .single();

          if (data && !sbError) {
            // Reconstruct minimal Journey object from public payload
            const pub = data as JourneyPublic;
            const geom = pub.display_geometry;
            const flatCoords: [number, number][] =
              geom.type === 'MultiLineString'
                ? (geom.coordinates as [number, number][][]).flat()
                : (geom.coordinates as [number, number][]);

            const synthTrack = flatCoords.map(([lng, lat], i) => ({
              latitude: lat,
              longitude: lng,
              altitude: null,
              accuracy: null,
              speed: null,
              heading: null,
              timestamp: pub.started_at + i * 1000,
              segment: 0,
            }));

            if (!ignore) {
              setJourney({
                id: pub.journey_id,
                title: pub.title,
                status: 'completed',
                visibility: 'unlisted',
                travel_mode: pub.travel_mode,
                vehicle: pub.vehicle,
                started_at: pub.started_at,
                distance_m: pub.distance_m,
                duration_s: pub.duration_s,
                moving_time_s: pub.duration_s,
                raw_track: synthTrack,
                display_geometry: pub.display_geometry,
                style: pub.style,
                created_at: pub.started_at,
              });
              setLoading(false);
              return;
            }
          }
        }

        // 2. Fallback to local Dexie database
        const local = await db.journeys.get(journeyId);
        if (local && !ignore) {
          setJourney(local);
          setLoading(false);
          return;
        }

        if (!ignore) {
          setError('Shared journey not found or has been deleted.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load shared journey:', err);
        if (!ignore) {
          setError('Failed to load shared journey.');
          setLoading(false);
        }
      }
    }

    loadSharedJourney();

    return () => {
      ignore = true;
    };
  }, [journeyId]);

  // Frame Interpolation
  const currentFrame =
    journey && journey.raw_track.length > 0
      ? interpolateTrackAtProgress(journey.raw_track, progress)
      : null;

  // Animation Loop
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime: number | null = null;
    let animId: number;

    const animate = (timestamp: number) => {
      if (lastTime !== null) {
        const deltaMs = timestamp - lastTime;
        const baseDurationSecs = 25;
        const deltaProgress = (deltaMs / 1000) / (baseDurationSecs / speed);

        setProgress((prev) => {
          const next = prev + deltaProgress;
          if (next >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return next;
        });
      }
      lastTime = timestamp;
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, speed]);

  const handleCloneToLocal = async () => {
    if (!journey) return;
    await db.journeys.put({
      ...journey,
      id: crypto.randomUUID(),
      title: `${journey.title} (Saved)`,
      created_at: Date.now(),
    });
    alert('Journey saved to your local offline journeys!');
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
        <span className="text-xs text-slate-400">Loading shared replay...</span>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center gap-4">
        <div className="p-3 bg-red-500/10 rounded-2xl text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Journey Not Found</h2>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            This unlisted replay link may have expired or was removed by its creator.
          </p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go to GeoDraw Home</span>
        </Link>
      </div>
    );
  }

  const currentVehiclePos = currentFrame
    ? {
        lng: currentFrame.currentPoint.longitude,
        lat: currentFrame.currentPoint.latitude,
        heading: currentFrame.heading,
      }
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between pt-safe px-3 sm:px-4 pb-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl">
          <Link
            href="/"
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
            title="Back to App"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-extrabold text-xs sm:text-sm tracking-tight text-white flex items-center gap-1.5">
              {journey.title}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              <span>Privacy Protected (Unlisted Replay)</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={handleCloneToLocal}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/95 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Save Copy</span>
          </button>
        </div>
      </header>

      {/* Map View */}
      <main className="w-full h-full">
        <MapView
          mapStyle={journey.style?.mapStyle || 'light'}
          routeStyle={journey.style?.routeStyle || 'classic'}
          vehicle={journey.vehicle || 'bike'}
          cameraMode={cameraMode}
          drawnGeometry={currentFrame?.lineGeometry ?? null}
          fullTrack={journey.raw_track}
          currentVehiclePos={currentVehiclePos}
        />
      </main>

      {/* Bottom Controls */}
      <footer className="absolute bottom-2 sm:bottom-6 left-0 right-0 z-30 pb-safe px-2.5 sm:px-4 pointer-events-none flex justify-center">
        <div className="w-full max-w-2xl pointer-events-auto">
          <ReplayControls
            isPlaying={isPlaying}
            progress={progress}
            speed={speed}
            cameraMode={cameraMode}
            distanceCoveredMeters={currentFrame?.drawnDistanceMeters ?? 0}
            totalDistanceMeters={journey.distance_m}
            elapsedSeconds={Math.round(journey.duration_s * progress)}
            totalDurationSeconds={journey.duration_s}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeek={setProgress}
            onChangeSpeed={setSpeed}
            onToggleCamera={() =>
              setCameraMode((prev) => (prev === 'follow' ? 'overview' : 'follow'))
            }
            onRestart={() => {
              setProgress(0);
              setIsPlaying(true);
            }}
            onOpenExport={() => setShowExportModal(true)}
          />
        </div>
      </footer>

      {showExportModal && (
        <ExportModal
          journey={journey}
          getMapCanvas={() => document.querySelector('canvas')}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
