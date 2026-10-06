import Dexie, { Table } from 'dexie';
import { Journey, StoredPoint } from '@/types';

export class GeoDrawDatabase extends Dexie {
  journeys!: Table<Journey, string>;
  points!: Table<StoredPoint, number>;

  constructor() {
    super('GeoDrawDB');

    this.version(1).stores({
      journeys: 'id, status, started_at, created_at, visibility',
      points: '++id, journey_id, seq, synced, [journey_id+seq]',
    });
  }
}

// Singleton database instance for client-side persistence
export const db = new GeoDrawDatabase();
