'use client';

import React, { useEffect } from 'react';
import { useRecorderStore } from '@/features/location/recorderStore';
import { TravelMode, VehicleType } from '@/types';
import { Play, Pause, Square, Circle, ShieldCheck } from 'lucide-react';

interface RecorderOverlayProps {
  onFinishedJourney?: () => void;
  onClose?: () => void;
}

export function RecorderOverlay({ onFinishedJourney, onClose }: RecorderOverlayProps) {
  const {
    state,
    points,
    distanceMeters,
    durationSeconds,
    lastPoint,
    startRecording,
    pauseRecording,
    resumeRecording,
    finishRecording,
    cancelRecording,
    addLocationPoint,
  } = useRecorderStore();

  // Manage watchPosition lifecycle while recording
  useEffect(() => {
    if (state !== 'RECORDING') return;

    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        addLocationPoint(pos.coords, pos.timestamp);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [state, addLocationPoint]);

  const handleStart = async (mode: TravelMode, vehicle: VehicleType) => {
    await startRecording(mode, vehicle);
  };

  const handleFinish = async () => {
    const journey = await finishRecording();
    if (journey && onFinishedJourney) {
      onFinishedJourney();
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const distanceKm = (distanceMeters / 1000).toFixed(2);
  const currentSpeedKmh =
    lastPoint?.speed !== null && lastPoint?.speed !== undefined
      ? (lastPoint.speed * 3.6).toFixed(1)
      : '0.0';

  if (state === 'IDLE') {
    return (
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl text-white max-w-sm w-full mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-bold text-sm">Start Live Recording</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800"
            >
              Close
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400">
          GeoDraw keeps your screen awake and records high-accuracy GPS points into your offline database.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {(['walk', 'bike', 'car'] as TravelMode[]).map((m) => (
            <button
              key={m}
              onClick={() => handleStart(m, m as VehicleType)}
              className="py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-rose-500 hover:border-rose-500 font-semibold text-xs capitalize transition text-center"
            >
              {m === 'walk' ? '🚶 Walk' : m === 'bike' ? '🚲 Bike' : '🚗 Drive'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl text-white max-w-sm w-full mx-auto flex flex-col gap-4 backdrop-blur-md">
      {/* Top Status & Wake Lock indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Circle
            className={`w-3.5 h-3.5 ${
              state === 'RECORDING' ? 'fill-rose-500 text-rose-500 animate-pulse' : 'fill-amber-500 text-amber-500'
            }`}
          />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
            {state === 'RECORDING' ? 'Live Recording' : 'Recording Paused'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3 h-3" />
          <span>Screen Awake</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800 text-center">
        <div>
          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Distance</span>
          <span className="text-xl font-bold text-white">{distanceKm}</span>
          <span className="text-[10px] text-slate-400 ml-1">km</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Time</span>
          <span className="text-xl font-bold text-rose-400">{formatTimer(durationSeconds)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Speed</span>
          <span className="text-xl font-bold text-cyan-400">{currentSpeedKmh}</span>
          <span className="text-[10px] text-slate-400 ml-1">km/h</span>
        </div>
      </div>

      {/* Points Status */}
      <div className="text-[11px] text-slate-400 flex items-center justify-between">
        <span>Points captured: <strong className="text-slate-200">{points.length}</strong></span>
        {lastPoint?.accuracy && (
          <span>Accuracy: ±{Math.round(lastPoint.accuracy)}m</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {state === 'RECORDING' ? (
          <button
            onClick={pauseRecording}
            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Pause className="w-4 h-4 fill-white" />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={resumeRecording}
            className="flex-1 py-2.5 px-4 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Resume</span>
          </button>
        )}

        <button
          onClick={handleFinish}
          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          <Square className="w-4 h-4 fill-white" />
          <span>Finish</span>
        </button>

        <button
          onClick={cancelRecording}
          className="py-2.5 px-3 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-xl text-xs font-semibold transition"
          title="Discard Journey"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
