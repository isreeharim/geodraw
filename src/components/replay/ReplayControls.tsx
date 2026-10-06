'use client';

import React, { useEffect } from 'react';
import { CameraMode, ReplaySpeed } from '@/types';
import { Play, Pause, RotateCcw, Video, Compass, MapPin } from 'lucide-react';

interface ReplayControlsProps {
  isPlaying: boolean;
  progress: number; // 0 to 1
  speed: ReplaySpeed;
  cameraMode: CameraMode;
  distanceCoveredMeters: number;
  totalDistanceMeters: number;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  onTogglePlay: () => void;
  onSeek: (progress: number) => void;
  onChangeSpeed: (speed: ReplaySpeed) => void;
  onToggleCamera: () => void;
  onRestart: () => void;
  onOpenExport: () => void;
}

export function ReplayControls({
  isPlaying,
  progress,
  speed,
  cameraMode,
  distanceCoveredMeters,
  totalDistanceMeters,
  elapsedSeconds,
  totalDurationSeconds,
  onTogglePlay,
  onSeek,
  onChangeSpeed,
  onToggleCamera,
  onRestart,
  onOpenExport,
}: ReplayControlsProps) {
  const speeds: ReplaySpeed[] = [1, 2, 5, 10];

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(1, progress + 0.05));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(0, progress - 0.05));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, progress, onTogglePlay, onSeek]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const distKm = (distanceCoveredMeters / 1000).toFixed(2);
  const totalKm = (totalDistanceMeters / 1000).toFixed(2);

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
      {/* Top HUD: Distance & Duration */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-slate-300 px-1">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-rose-500" />
          <span>
            <strong className="text-white">{distKm}</strong> / {totalKm} km
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>
            <strong className="text-white">{formatTime(elapsedSeconds)}</strong> /{' '}
            {formatTime(totalDurationSeconds)}
          </span>
        </div>
      </div>

      {/* Scrub Bar */}
      <div className="relative flex items-center">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer focus:outline-none"
        />
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Play / Pause */}
          <button
            onClick={onTogglePlay}
            className="p-3 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-full transition shadow-lg shadow-rose-500/20"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
          </button>

          {/* Restart */}
          <button
            onClick={onRestart}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition"
            title="Restart replay"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Toggles */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-1 gap-1">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  speed === s ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Camera Mode Toggle */}
          <button
            onClick={onToggleCamera}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition ${
              cameraMode === 'follow'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Toggle Camera Mode"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="capitalize">{cameraMode}</span>
          </button>

          {/* Export Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-90 active:scale-95 text-white shadow-lg transition"
          >
            <Video className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}
