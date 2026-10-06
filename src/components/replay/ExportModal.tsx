'use client';

import React, { useState } from 'react';
import { Journey } from '@/types';
import {
  generateJourneyCard,
  generateReplayVideo,
  checkVideoSupport,
} from '@/features/export/canvasExport';
import { createPublicJourneyPayload } from '@/features/sharing/privacy';
import {
  X,
  Image as ImageIcon,
  Video,
  Share2,
  Download,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface ExportModalProps {
  journey: Journey;
  getMapCanvas: () => HTMLCanvasElement | null;
  onClose: () => void;
}

export function ExportModal({ journey, getMapCanvas, onClose }: ExportModalProps) {
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [cardDownloaded, setCardDownloaded] = useState(false);

  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDownloaded, setVideoDownloaded] = useState(false);

  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const videoSupport = checkVideoSupport();

  // Export Journey Card (4:5 / Social Poster)
  const handleGenerateCard = async () => {
    try {
      setIsGeneratingCard(true);
      const dataUrl = await generateJourneyCard(journey, { theme: 'dark' });

      // Trigger download
      const link = document.createElement('a');
      link.download = `${journey.title.toLowerCase().replace(/\s+/g, '-')}-card.png`;
      link.href = dataUrl;
      link.click();
      setCardDownloaded(true);
      setTimeout(() => setCardDownloaded(false), 3000);
    } catch (err) {
      console.error('Failed to generate journey card:', err);
    } finally {
      setIsGeneratingCard(false);
    }
  };

  // Export Map View Screenshot (PNG)
  const handleExportMapScreenshot = () => {
    const mapCanvas = getMapCanvas();
    if (!mapCanvas) return;
    try {
      const dataUrl = mapCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${journey.title.toLowerCase().replace(/\s+/g, '-')}-map.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export map screenshot:', err);
    }
  };

  // Export 9:16 Replay Video Reel
  const handleGenerateVideo = async () => {
    if (!videoSupport.supported) return;
    try {
      setIsGeneratingVideo(true);
      setVideoProgress(0);

      const blob = await generateReplayVideo(journey, (p) => {
        setVideoProgress(Math.round(p * 100));
      });

      const videoUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${journey.title.toLowerCase().replace(/\s+/g, '-')}-reel.webm`;
      link.href = videoUrl;
      link.click();

      setVideoDownloaded(true);
      setTimeout(() => {
        setVideoDownloaded(false);
        URL.revokeObjectURL(videoUrl);
      }, 5000);
    } catch (err) {
      console.error('Failed to render video reel:', err);
      alert('Video export could not be completed. You can export a Journey Card instead.');
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress(0);
    }
  };

  // Generate Unlisted Share Link
  const handleGenerateShareLink = () => {
    const publicPayload = createPublicJourneyPayload(journey, 200);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // Share link points to public unlisted view route
    const link = `${origin}/share/${publicPayload.journey_id}`;
    setShareLink(link);
    navigator.clipboard.writeText(link);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-[32px] sm:rounded-3xl shadow-2xl p-5 sm:p-6 text-white flex flex-col gap-4 sm:gap-6 max-h-[90dvh] overflow-y-auto pb-safe">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto sm:hidden -mt-1 mb-0.5" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-xl text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Export & Share Journey</h2>
              <p className="text-xs text-slate-400">Share your replay without compromising privacy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 1. Journey Card */}
          <button
            onClick={handleGenerateCard}
            disabled={isGeneratingCard}
            className="flex flex-col items-start p-4 rounded-2xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-rose-500/50 transition group text-left active:scale-[0.98]"
          >
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl mb-3 group-hover:scale-105 transition">
              {isGeneratingCard ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </div>
            <span className="font-semibold text-sm mb-1">
              {cardDownloaded ? 'Card Downloaded!' : isGeneratingCard ? 'Generating Card...' : 'Journey Card (PNG)'}
            </span>
            <span className="text-xs text-slate-400">
              High-res poster with route silhouette & statistics
            </span>
          </button>

          {/* 2. Map Snapshot */}
          <button
            onClick={handleExportMapScreenshot}
            className="flex flex-col items-start p-4 rounded-2xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-amber-500/50 transition group text-left active:scale-[0.98]"
          >
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl mb-3 group-hover:scale-105 transition">
              <Download className="w-5 h-5" />
            </div>
            <span className="font-semibold text-sm mb-1">Map View Screenshot</span>
            <span className="text-xs text-slate-400">
              Direct high-resolution snapshot of current map camera
            </span>
          </button>

          {/* 3. Replay Video Reel (Fully Interactive Client-Side Rendering) */}
          <button
            onClick={handleGenerateVideo}
            disabled={!videoSupport.supported || isGeneratingVideo}
            className={`flex flex-col items-start p-4 rounded-2xl border transition group text-left sm:col-span-2 active:scale-[0.98] ${
              videoSupport.supported
                ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-cyan-500/50'
                : 'border-slate-800/40 bg-slate-800/20 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl group-hover:scale-105 transition">
                  {isGeneratingVideo ? (
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  ) : (
                    <Video className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="font-semibold text-sm block">
                    {videoDownloaded
                      ? 'Video Reel Downloaded!'
                      : isGeneratingVideo
                      ? `Rendering Reel: ${videoProgress}%`
                      : '9:16 Video Reel (TikTok / Reels)'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {videoSupport.supported
                      ? isGeneratingVideo
                        ? 'Capturing canvas frames in real-time...'
                        : 'Render 3-second animated replay video directly in your browser'
                      : 'Video recording unsupported on this browser'}
                  </span>
                </div>
              </div>

              {isGeneratingVideo && (
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg">
                  {videoProgress}%
                </span>
              )}
            </div>

            {/* Progress bar when rendering */}
            {isGeneratingVideo && (
              <div className="w-full bg-slate-700/60 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-100 ease-out"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
            )}
          </button>
        </div>

        {/* Share Link Generation (with Privacy Notice) */}
        <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-rose-400" />
              Unlisted Link (Privacy-Trimmed)
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
              Start/End 200m clipped
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareLink || 'Click create link to generate secure unlisted URL'}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
            />
            <button
              onClick={handleGenerateShareLink}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow"
            >
              {copiedShareLink ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                'Create Link'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
