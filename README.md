# GeoDraw 🗺️✨

> **Turn real-world journeys into animated route replays, shareable journey cards, and video reels.**

GeoDraw is an offline-first Progressive Web App built with Next.js (App Router), TypeScript, MapLibre GL JS, Turf.js, Dexie (IndexedDB), and Supabase.

---

## 🚀 Key Features

* **Guest-First & Zero Friction:** Record or import GPX journeys immediately without requiring account creation.
* **Timestamp-Driven Replay Engine:** Reconstruct continuous journeys with smooth sub-second coordinate interpolation, dynamic camera tracking (Follow vs. Overview), and speed multipliers ($1\times, 2\times, 5\times, 10\times$).
* **Offline-First Persistence (Dexie / IndexedDB):** Active GPS points are persisted locally with segment boundaries; journeys survive tab refreshes, browser reloads, and offline conditions.
* **Segment-Aware GPS Engine:** Pause/resume creates distinct segments so stops and transport gaps are never drawn or counted toward total distance. Includes noise filtering, stationary jitter suppression, and mode speed limits.
* **Instant Export:**
  * **Journey Card (PNG):** Social media portrait poster (4:5) featuring title, date, key metrics, and route silhouette.
  * **Map View Screenshot:** High-resolution capture directly from the MapLibre WebGL canvas (`preserveDrawingBuffer`).
  * **Replay Video:** Client-side canvas video generation with feature detection.
* **Privacy By Default:**
  * First and last $200\,\text{m}$ (configurable) are automatically clipped upon sharing to protect home/work locations.
  * Unlisted links generated with $\ge 128$-bit random cryptographic tokens.
  * "Delete all my data" purges local IndexedDB storage and remote databases completely.

---

## 🏗️ Architecture

```text
Browser
 ├─ Location Engine (watchPosition → validate → smooth → jitter suppression)
 ├─ Journey State Machine (persisted in Dexie IndexedDB)
 ├─ MapLibre GL JS (Vector tiles, GeoJSON line & pulse layers, 0 DOM markers)
 ├─ Replay Engine (Timestamp interpolation, dynamic follow camera, bearing)
 └─ Exporter (PNG Journey Cards & Map snapshots via Canvas)
            │
            ▼
Supabase: Auth · Postgres with RLS · Storage
```

---

## ⚖️ Engineering Decisions & Tradeoffs

1. **Why Client-Side Video & Canvas Export over Cloud Rendering (Remotion Serverless):**
   * Eliminates costly server-side video rendering infrastructure and cold starts.
   * Runs free-to-operate on standard static/edge hosting (Vercel Hobby).
2. **Why Guest-First & IndexedDB as Primary Source of Truth:**
   * GPS tracking must never fail due to transient network dropouts in tunnels or rural areas.
   * Client-generated UUIDs allow journeys to exist immediately before any server synchronization.
3. **Why Separation of Raw Track vs. Display Geometry:**
   * Raw GPS tracks remain immutable and owner-only.
   * Display geometry is generated on-demand via Douglas–Peucker simplification (`@turf/turf`) to minimize rendering overhead.
4. **Why Idempotent Sync with `(journey_id, seq)`:**
   * Guarantees zero duplicate points and zero lost points on mobile reconnection retries.

---

## ⚠️ Known Constraints & Real-World Handling

| Constraint | Handling |
|---|---|
| Mobile browsers throttle GPS when backgrounded (especially iOS Safari) | Screen Wake Lock API active during recording + GPX import as a primary reliable path. |
| Browser altitude noise | GPS altitude is filtered; elevation metrics are labeled approximate or excluded. |
| Vector Tile Provider | Uses free vector tiles (OpenFreeMap / Carto CDN GL) without vendor lock-in or proprietary keys. |

---

## 🛠️ Tech Stack

* **Framework:** Next.js (App Router, Turbopack) + TypeScript strict
* **Styling:** Tailwind CSS + Lucide Icons
* **Mapping:** MapLibre GL JS
* **Spatial Algorithms:** Turf.js (`@turf/turf`)
* **Client State:** Zustand
* **Local Database:** Dexie.js (IndexedDB)
* **Backend:** Supabase (Auth, Postgres with Row-Level Security)
* **Testing:** Vitest

---

## 🧪 Testing & Verification

Run the automated test suite:

```bash
npm test
```

Run production build:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

---

## 💼 Resume Summary

> Built **GeoDraw**, an offline-first PWA (Next.js, TypeScript, MapLibre GL, Turf.js, Supabase) that turns GPS tracks into animated replays and exportable social cards; implemented segment-aware GPS filtering, jitter suppression, timestamp interpolation, and client-side canvas rendering.
