import { create } from 'zustand';
import { GPSPoint, Journey, RecorderState, TravelMode, VehicleType } from '@/types';
import { db } from '@/lib/storage/db';
import {
  calculateDistance,
  filterJitter,
  validatePoint,
  simplifyTrack,
} from '@/lib/geo/calculations';

type WakeLockSentinelType = {
  release: () => Promise<void>;
};

interface RecorderStore {
  state: RecorderState;
  currentJourney: Journey | null;
  activeSegment: number;
  points: GPSPoint[];
  lastPoint: GPSPoint | null;
  distanceMeters: number;
  durationSeconds: number;
  wakeLock: WakeLockSentinelType | null;
  watchId: number | null;
  errorMessage: string | null;

  startRecording: (mode?: TravelMode, vehicle?: VehicleType) => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  finishRecording: () => Promise<Journey | null>;
  cancelRecording: () => Promise<void>;
  addLocationPoint: (coords: GeolocationCoordinates, timestamp: number) => Promise<void>;
  recoverUnfinishedJourney: () => Promise<Journey | null>;
}

export const useRecorderStore = create<RecorderStore>((set, get) => ({
  state: 'IDLE',
  currentJourney: null,
  activeSegment: 0,
  points: [],
  lastPoint: null,
  distanceMeters: 0,
  durationSeconds: 0,
  wakeLock: null,
  watchId: null,
  errorMessage: null,

  startRecording: async (mode = 'walk', vehicle = 'walk') => {
    // Generate client-side UUID
    const journeyId = crypto.randomUUID();
    const now = Date.now();

    const newJourney: Journey = {
      id: journeyId,
      user_id: null,
      title: `Journey on ${new Date(now).toLocaleDateString()}`,
      status: 'recording',
      visibility: 'private',
      travel_mode: mode,
      vehicle: vehicle,
      started_at: now,
      ended_at: null,
      distance_m: 0,
      duration_s: 0,
      moving_time_s: 0,
      raw_track: [],
      display_geometry: null,
      style: {
        mapStyle: 'light',
        routeStyle: 'classic',
        cameraMode: 'follow',
      },
      created_at: now,
    };

    // Save initial journey to Dexie
    await db.journeys.put(newJourney);

    // Request screen wake lock if available
    let wakeLockSentinel: WakeLockSentinelType | null = null;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockSentinel = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinelType> } }).wakeLock.request('screen');
      } catch (err) {
        console.warn('Screen wake lock request failed:', err);
      }
    }

    set({
      state: 'RECORDING',
      currentJourney: newJourney,
      activeSegment: 0,
      points: [],
      lastPoint: null,
      distanceMeters: 0,
      durationSeconds: 0,
      wakeLock: wakeLockSentinel,
      errorMessage: null,
    });
  },

  pauseRecording: async () => {
    const { currentJourney, points, activeSegment, distanceMeters, durationSeconds } = get();
    if (!currentJourney) return;

    const nextSegment = activeSegment + 1;
    const updatedJourney: Journey = {
      ...currentJourney,
      distance_m: distanceMeters,
      duration_s: durationSeconds,
      raw_track: points,
    };

    await db.journeys.put(updatedJourney);

    set({
      state: 'PAUSED',
      activeSegment: nextSegment,
      currentJourney: updatedJourney,
    });
  },

  resumeRecording: async () => {
    const { state } = get();
    if (state !== 'PAUSED') return;

    set({ state: 'RECORDING' });
  },

  addLocationPoint: async (coords: GeolocationCoordinates, timestamp: number) => {
    const { state, currentJourney, points, lastPoint, activeSegment } = get();
    if (state !== 'RECORDING' || !currentJourney) return;

    const newPoint: GPSPoint = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      timestamp: timestamp,
      segment: activeSegment,
    };

    // 1. Validation
    const validation = validatePoint(newPoint, lastPoint, currentJourney.travel_mode);
    if (!validation.valid) {
      console.warn('GPS point rejected:', validation.reason);
      return;
    }

    // 2. Jitter suppression
    if (filterJitter(newPoint, lastPoint)) {
      return;
    }

    const updatedPoints = [...points, newPoint];
    const seq = updatedPoints.length;
    const newDistance = calculateDistance(updatedPoints);
    const durationSec = Math.round((timestamp - currentJourney.started_at) / 1000);

    // 3. Persist point to Dexie
    await db.points.put({
      ...newPoint,
      journey_id: currentJourney.id,
      seq: seq,
      synced: false,
    });

    // 4. Update journey summary in Dexie
    await db.journeys.update(currentJourney.id, {
      distance_m: newDistance,
      duration_s: durationSec,
      raw_track: updatedPoints,
    });

    set({
      points: updatedPoints,
      lastPoint: newPoint,
      distanceMeters: newDistance,
      durationSeconds: durationSec,
    });
  },

  finishRecording: async () => {
    const { currentJourney, points, distanceMeters, durationSeconds, wakeLock } = get();
    if (!currentJourney) return null;

    set({ state: 'FINISHING' });

    // Release wake lock
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch (err) {
        console.warn('Wake lock release error:', err);
      }
    }

    const simplifiedGeo = simplifyTrack(points);

    const completedJourney: Journey = {
      ...currentJourney,
      status: 'completed',
      ended_at: Date.now(),
      distance_m: distanceMeters,
      duration_s: durationSeconds,
      raw_track: points,
      display_geometry: simplifiedGeo,
    };

    await db.journeys.put(completedJourney);

    set({
      state: 'COMPLETED',
      currentJourney: completedJourney,
      wakeLock: null,
    });

    return completedJourney;
  },

  cancelRecording: async () => {
    const { currentJourney, wakeLock } = get();
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch {
        // Ignore wake lock release error
      }
    }

    if (currentJourney) {
      await db.journeys.delete(currentJourney.id);
      await db.points.where('journey_id').equals(currentJourney.id).delete();
    }

    set({
      state: 'IDLE',
      currentJourney: null,
      points: [],
      lastPoint: null,
      distanceMeters: 0,
      durationSeconds: 0,
      wakeLock: null,
    });
  },

  recoverUnfinishedJourney: async () => {
    // Check if an uncompleted journey exists in Dexie
    const unfinished = await db.journeys
      .where('status')
      .equals('recording')
      .first();

    if (!unfinished) return null;

    // Load persisted points
    const storedPoints = await db.points
      .where('journey_id')
      .equals(unfinished.id)
      .sortBy('seq');

    const lastPt = storedPoints.length > 0 ? storedPoints[storedPoints.length - 1] : null;
    const maxSegment = storedPoints.reduce((max, p) => Math.max(max, p.segment), 0);

    set({
      state: 'PAUSED', // Resume in paused state for safety
      currentJourney: unfinished,
      points: storedPoints,
      lastPoint: lastPt,
      activeSegment: maxSegment + 1,
      distanceMeters: unfinished.distance_m,
      durationSeconds: unfinished.duration_s,
    });

    return unfinished;
  },
}));
