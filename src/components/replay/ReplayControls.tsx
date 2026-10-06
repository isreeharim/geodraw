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
    <div className="w-full max-w-3xl mx-auto bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 text-white rounded-3xl p-3.5 sm:p-4 shadow-2xl flex flex-col gap-2.5 sm:gap-3 transition-all">
      {/* Top HUD: Distance & Duration */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-slate-300 px-1">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
          <span className="text-xs sm:text-sm">
            <strong className="text-white font-semibold">{distKm}</strong>
            <span className="text-slate-400"> / {totalKm} km</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
          <strong className="text-white font-semibold">{formatTime(elapsedSeconds)}</strong>
          <span className="text-slate-400"> / {formatTime(totalDurationSeconds)}</span>
        </div>
      </div>

      {/* Scrub Bar (touch friendly hit target) */}
      <div className="relative flex items-center py-1">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-700/80 rounded-lg appearance-none cursor-pointer focus:outline-none"
        />
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        {/* Left: Play / Restart / Speeds */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Play / Pause button with 44px touch target */}
          <button
            onClick={onTogglePlay}
            className="w-11 h-11 sm:w-12 sm:h-12 bg-rose-500 hover:bg-rose-600 active:scale-90 text-white rounded-2xl flex items-center justify-center transition shadow-lg shadow-rose-500/25 flex-shrink-0"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white translate-x-0.5" />
            )}
          </button>

          {/* Restart */}
          <button
            onClick={onRestart}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-xl flex items-center justify-center transition flex-shrink-0"
            title="Restart replay"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Toggles */}
          <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 sm:p-1 gap-0.5">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition active:scale-95 ${
                  speed === s
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Right: Camera Mode & Export */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Camera Mode Toggle */}
          <button
            onClick={onToggleCamera}
            className={`h-9 sm:h-10 px-2.5 sm:px-3 text-xs font-medium rounded-xl border flex items-center gap-1.5 transition active:scale-95 ${
              cameraMode === 'follow'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            title="Toggle Camera Follow/Overview"
          >
            <Compass className="w-4 h-4" />
            <span className="hidden md:inline capitalize">{cameraMode}</span>
          </button>

          {/* Export Button */}
          <button
            onClick={onOpenExport}
            className="h-9 sm:h-10 px-3 sm:px-4 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 active:scale-90 text-white shadow-lg transition flex items-center gap-1.5"
          >
            <Video className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}
