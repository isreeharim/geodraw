'use client';

import React, { useEffect, useState } from 'react';
import { Journey } from '@/types';
import { db } from '@/lib/storage/db';
import { X, Play, Trash2, Calendar, MapPin, Clock, AlertTriangle } from 'lucide-react';

interface JourneysListModalProps {
  onSelectJourney: (journey: Journey) => void;
  onClose: () => void;
}

export function JourneysListModal({ onSelectJourney, onClose }: JourneysListModalProps) {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJourneys = async () => {
    try {
      const list = await db.journeys.orderBy('created_at').reverse().toArray();
      setJourneys(list);
    } catch (err) {
      console.error('Failed to load journeys from Dexie:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    db.journeys
      .orderBy('created_at')
      .reverse()
      .toArray()
      .then((list) => {
        if (!ignore) {
          setJourneys(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load journeys from Dexie:', err);
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleDeleteJourney = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this journey?')) return;
    await db.journeys.delete(id);
    await db.points.where('journey_id').equals(id).delete();
    await loadJourneys();
  };

  const handleDeleteAllData = async () => {
    if (
      !confirm(
        'Are you sure you want to delete ALL journeys and offline points from this device? This action cannot be undone.'
      )
    )
      return;

    await db.journeys.clear();
    await db.points.clear();
    await loadJourneys();
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    return `${mins} min`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border-t sm:border border-slate-800 rounded-t-[32px] sm:rounded-3xl shadow-2xl p-5 sm:p-6 text-white flex flex-col gap-4 sm:gap-5 max-h-[88dvh] pb-safe">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto sm:hidden -mt-1 mb-0.5" />
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold">My Saved Journeys</h2>
            <p className="text-xs text-slate-400">Stored safely on this device (offline-first)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading journeys...</div>
          ) : journeys.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <MapPin className="w-8 h-8 opacity-40 text-slate-400" />
              <span>No journeys recorded yet. Record or import a GPX to get started!</span>
            </div>
          ) : (
            journeys.map((j) => (
              <div
                key={j.id}
                onClick={() => {
                  onSelectJourney(j);
                  onClose();
                }}
                className="p-3.5 rounded-2xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-700 cursor-pointer transition flex items-center justify-between group"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-rose-400 transition">
                      {j.title}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                      {j.travel_mode}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      {(j.distance_m / 1000).toFixed(2)} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {formatDuration(j.duration_s)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(j.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDeleteJourney(j.id, e)}
                    className="p-2 text-slate-500 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition"
                    title="Delete journey"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-2 text-rose-400 rounded-xl bg-rose-500/10 group-hover:bg-rose-500 group-hover:text-white transition">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Delete All Data */}
        {journeys.length > 0 && (
          <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
            <button
              onClick={handleDeleteAllData}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Delete all my data</span>
            </button>
            <span className="text-xs text-slate-500">{journeys.length} saved</span>
          </div>
        )}
      </div>
    </div>
  );
}
