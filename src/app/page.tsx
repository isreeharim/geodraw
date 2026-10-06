'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  CameraMode,
  Journey,
  MapStyleId,
  ReplaySpeed,
  RouteStyleId,
  VehicleType,
} from '@/types';
import { parseGpx } from '@/features/import/gpx';
import { interpolateTrackAtProgress } from '@/features/replay/interpolator';
import { calculateDistance, simplifyTrack } from '@/lib/geo/calculations';
import { db } from '@/lib/storage/db';
import { useRecorderStore } from '@/features/location/recorderStore';
import { ReplayControls } from '@/components/replay/ReplayControls';
import { StylePicker } from '@/components/replay/StylePicker';
import { ExportModal } from '@/components/replay/ExportModal';
import { RecorderOverlay } from '@/components/recorder/RecorderOverlay';
import { JourneysListModal } from '@/components/journeys/JourneysListModal';
import {
  Upload,
  Radio,
  Sliders,
  FolderHeart,
  Navigation2,
  RotateCw,
} from 'lucide-react';

// Dynamic import for MapLibre map component to avoid SSR window issues
const MapView = dynamic(
  () => import('@/components/map/MapView').then((mod) => mod.MapView),
  { ssr: false }
);

// Sample route data for immediate out-of-the-box demo
const SAMPLE_JOURNEY: Journey = {
  id: 'sample-sf-route',
  user_id: null,
  title: 'Scenic Embarcadero & Bridge Run',
  status: 'completed',
  visibility: 'private',
  travel_mode: 'bike',
  vehicle: 'bike',
  started_at: 1700000000000,
  ended_at: 1700001800000,
  distance_m: 5420,
  duration_s: 1800,
  moving_time_s: 1750,
  raw_track: [
    { latitude: 37.7955, longitude: -122.3937, altitude: 5, accuracy: 4, speed: 4.2, heading: 320, timestamp: 1700000000000, segment: 0 },
    { latitude: 37.7985, longitude: -122.3970, altitude: 6, accuracy: 4, speed: 4.5, heading: 315, timestamp: 1700000300000, segment: 0 },
    { latitude: 37.8020, longitude: -122.4010, altitude: 7, accuracy: 3, speed: 4.8, heading: 310, timestamp: 1700000600000, segment: 0 },
    { latitude: 37.8055, longitude: -122.4060, altitude: 8, accuracy: 3, speed: 5.1, heading: 300, timestamp: 1700000900000, segment: 0 },
    { latitude: 37.8075, longitude: -122.4130, altitude: 9, accuracy: 4, speed: 4.9, heading: 280, timestamp: 1700001200000, segment: 0 },
    { latitude: 37.8060, longitude: -122.4220, altitude: 10, accuracy: 4, speed: 4.7, heading: 260, timestamp: 1700001500000, segment: 0 },
    { latitude: 37.8045, longitude: -122.4330, altitude: 11, accuracy: 3, speed: 4.6, heading: 255, timestamp: 1700001800000, segment: 0 },
  ],
  display_geometry: null,
  style: {
    mapStyle: 'light',
    routeStyle: 'classic',
    cameraMode: 'follow',
  },
  created_at: 1700000000000,
};

export default function Home() {
  // Journey & Replay State
  const [activeJourney, setActiveJourney] = useState<Journey>(SAMPLE_JOURNEY);
  const [progress, setProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<ReplaySpeed>(2);
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [mapStyle, setMapStyle] = useState<MapStyleId>('light');
  const [routeStyle, setRouteStyle] = useState<RouteStyleId>('neon');
  const [vehicle, setVehicle] = useState<VehicleType>('bike');

  // UI Panels
  const [showStylePicker, setShowStylePicker] = useState<boolean>(false);
  const [showRecorderOverlay, setShowRecorderOverlay] = useState<boolean>(false);
  const [showJourneysList, setShowJourneysList] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [unfinishedAlert, setUnfinishedAlert] = useState<Journey | null>(null);

  // References
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderStore = useRecorderStore();
  const recoverUnfinishedJourney = useRecorderStore((s) => s.recoverUnfinishedJourney);

  // Check for unfinished journey on initial load
  useEffect(() => {
    async function checkUnfinished() {
      const unfinished = await recoverUnfinishedJourney();
      if (unfinished) {
        setUnfinishedAlert(unfinished);
      }
    }
    checkUnfinished();
  }, [recoverUnfinishedJourney]);

  // Compute interpolated frame for current progress
  const currentFrame = activeJourney.raw_track.length > 0
    ? interpolateTrackAtProgress(activeJourney.raw_track, progress)
    : null;

  // Animation Loop for replay
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      lastTimeRef.current = null;
      return;
    }

    const animate = (timestamp: number) => {
      if (lastTimeRef.current !== null) {
        const deltaMs = timestamp - lastTimeRef.current;
        // Total base duration: ~25 seconds for full replay at 1x
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
      lastTimeRef.current = timestamp;
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, speed]);

  // Handle GPX File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        const parsed = parseGpx(content);
        if (parsed.points.length < 2) {
          alert('GPX file does not contain enough track points.');
          return;
        }

        const distanceM = calculateDistance(parsed.points);
        const durationS = Math.round(
          (parsed.points[parsed.points.length - 1].timestamp - parsed.points[0].timestamp) / 1000
        );

        const newJourney: Journey = {
          id: crypto.randomUUID(),
          title: parsed.title || file.name.replace(/\.gpx$/i, ''),
          status: 'completed',
          visibility: 'private',
          travel_mode: 'bike',
          vehicle: vehicle,
          started_at: parsed.points[0].timestamp,
          ended_at: parsed.points[parsed.points.length - 1].timestamp,
          distance_m: distanceM,
          duration_s: durationS,
          moving_time_s: durationS,
          raw_track: parsed.points,
          display_geometry: simplifyTrack(parsed.points),
          style: {
            mapStyle,
            routeStyle,
            cameraMode,
          },
          created_at: Date.now(),
        };

        // Persist to Dexie
        await db.journeys.put(newJourney);

        // Load into active viewer
        setActiveJourney(newJourney);
        setProgress(0);
        setIsPlaying(true);
      } catch (err) {
        console.error('Failed to parse GPX:', err);
        alert('Could not parse GPX file. Please check format.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleSeek = (newProgress: number) => {
    setProgress(newProgress);
  };

  const handleRestart = () => {
    setProgress(0);
    setIsPlaying(true);
  };

  const currentVehiclePos = currentFrame
    ? {
        lng: currentFrame.currentPoint.longitude,
        lat: currentFrame.currentPoint.latitude,
        heading: currentFrame.heading,
      }
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 1. TOP NAVBAR */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 pointer-events-none">
        {/* Brand */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Navigation2 className="w-4 h-4 fill-white -rotate-45" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              GeoDraw
              <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded">
                v2
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[140px] sm:max-w-xs">
              {activeJourney.title}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Hidden GPX File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".gpx"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Import GPX */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md transition active:scale-95"
            title="Import GPX Track"
          >
            <Upload className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Import GPX</span>
          </button>

          {/* Live Record Toggle */}
          <button
            onClick={() => setShowRecorderOverlay(!showRecorderOverlay)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md transition active:scale-95 ${
              recorderStore.state === 'RECORDING'
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-200 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Live Record</span>
          </button>

          {/* Style Customizer */}
          <button
            onClick={() => setShowStylePicker(!showStylePicker)}
            className={`p-2 border rounded-xl shadow-lg backdrop-blur-md transition active:scale-95 ${
              showStylePicker
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
            title="Change Map & Route Style"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Saved Journeys */}
          <button
            onClick={() => setShowJourneysList(true)}
            className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl shadow-lg backdrop-blur-md transition active:scale-95"
            title="My Saved Journeys"
          >
            <FolderHeart className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. UNFINISHED JOURNEY RESUME BANNER */}
      {unfinishedAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-md w-full px-4 pointer-events-auto">
          <div className="bg-amber-950/90 border border-amber-600/50 backdrop-blur-md rounded-2xl p-3.5 text-white flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-amber-400 animate-spin" />
              <div className="text-xs">
                <span className="font-bold block text-amber-200">Unfinished Journey Detected</span>
                <span className="text-amber-400/80">Would you like to resume or finalize it?</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setShowRecorderOverlay(true);
                  setUnfinishedAlert(null);
                }}
                className="px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 font-semibold rounded-lg text-slate-950 transition"
              >
                Resume
              </button>
              <button
                onClick={async () => {
                  await recorderStore.finishRecording();
                  setUnfinishedAlert(null);
                }}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 font-semibold rounded-lg text-slate-200 transition"
              >
                Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. HERO MAP VIEW CONTAINER */}
      <main className="w-full h-full">
        <MapView
          mapStyle={mapStyle}
          routeStyle={routeStyle}
          vehicle={vehicle}
          cameraMode={cameraMode}
          drawnGeometry={currentFrame?.lineGeometry ?? null}
          fullTrack={activeJourney.raw_track}
          currentVehiclePos={currentVehiclePos}
          onMapLoaded={(map) => {
            mapCanvasRef.current = map.getCanvas();
          }}
        />
      </main>

      {/* 4. FLOATING PANELS */}
      {/* Style & Vehicle Selector */}
      {showStylePicker && (
        <div className="absolute top-20 right-4 z-30 max-w-xs w-full animate-in fade-in duration-150">
          <StylePicker
            currentMapStyle={mapStyle}
            currentRouteStyle={routeStyle}
            currentVehicle={vehicle}
            onSelectMapStyle={setMapStyle}
            onSelectRouteStyle={setRouteStyle}
            onSelectVehicle={setVehicle}
          />
        </div>
      )}

      {/* Live Recorder HUD */}
      {showRecorderOverlay && (
        <div className="absolute top-20 left-4 z-30 animate-in fade-in duration-150">
          <RecorderOverlay
            onFinishedJourney={() => {
              if (recorderStore.currentJourney) {
                setActiveJourney(recorderStore.currentJourney);
                setProgress(0);
                setIsPlaying(true);
              }
              setShowRecorderOverlay(false);
            }}
            onClose={() => setShowRecorderOverlay(false)}
          />
        </div>
      )}

      {/* 5. BOTTOM REPLAY CONTROLLER */}
      <footer className="absolute bottom-6 left-0 right-0 z-30 px-4 pointer-events-none flex justify-center">
        <div className="w-full max-w-2xl pointer-events-auto">
          <ReplayControls
            isPlaying={isPlaying}
            progress={progress}
            speed={speed}
            cameraMode={cameraMode}
            distanceCoveredMeters={currentFrame?.drawnDistanceMeters ?? 0}
            totalDistanceMeters={activeJourney.distance_m}
            elapsedSeconds={Math.round(activeJourney.duration_s * progress)}
            totalDurationSeconds={activeJourney.duration_s}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeek={handleSeek}
            onChangeSpeed={setSpeed}
            onToggleCamera={() =>
              setCameraMode((prev) => (prev === 'follow' ? 'overview' : 'follow'))
            }
            onRestart={handleRestart}
            onOpenExport={() => setShowExportModal(true)}
          />
        </div>
      </footer>

      {/* 6. MODALS */}
      {showExportModal && (
        <ExportModal
          journey={activeJourney}
          getMapCanvas={() => mapCanvasRef.current}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showJourneysList && (
        <JourneysListModal
          onSelectJourney={(selected) => {
            setActiveJourney(selected);
            setProgress(0);
            setIsPlaying(true);
          }}
          onClose={() => setShowJourneysList(false)}
        />
      )}
    </div>
  );
}
