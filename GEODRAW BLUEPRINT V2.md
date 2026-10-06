# GeoDraw — Blueprint v2 (Resume-Project Edition)

> **GeoDraw turns a real-world journey into an animated route replay, a shareable image, and a short video.**

**Goal:** a polished, reliable, free-to-run web app that real testers can use and a recruiter can understand in two minutes. No monetization, no growth features.

**Principle:** finish a small thing well. Every feature must serve *record or import → replay → export → share*.

---

## 1. Scope

### In (MVP)
- Guest-first: record or import with no login; sign in only to save/sync/share
- GPX import (primary validation path)
- Live recording, screen-on (Wake Lock)
- Pause / resume / finish, with segment-aware distance
- Live route drawing + moving vehicle (3–4 vehicles)
- Journey replay with speed control (1×, 2×, 5×, 10×)
- 3 map styles (Light, Dark, Minimal) and 4 route styles (Classic, Neon, Gradient, Dashed)
- PNG export, journey card, client-side video export (one 9:16 preset first)
- Private by default, unlisted share link
- Delete journey, delete all my data

### Out (explicitly)
Monetization, social feed, followers, comments, challenges and leaderboards, collaboration, admin dashboard, feature flags, quotas, native apps, AI features, satellite and terrain, microservices.

> Out-of-scope items go in the README's "Future work" section. Interviewers read that as judgment, not omission.

---

## 2. Known Constraints (state these honestly in the README)

| Constraint | Handling |
|---|---|
| Web GPS stops when the screen locks or the tab is backgrounded (worst on iOS) | Wake Lock API, "keep screen on" banner, GPX import as the reliable path |
| `watchPosition` can't set GPS interval | Filter points client-side; don't claim GPS battery savings |
| Free tiers change and projects can pause | Supabase free pauses after about a week idle; document it, add a keep-alive ping |
| Map tile terms | Do not use public OSM tile servers; use MapTiler free tier or Protomaps (PMTiles) |
| iOS video APIs vary | Feature-detect MediaRecorder/WebCodecs; fall back to PNG + replay link |

---

## 3. Tech Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript strict | Vercel Hobby is fine for non-commercial use |
| UI | Tailwind + shadcn/ui | Map is the hero; minimal chrome |
| Map | MapLibre GL JS | Provider behind a `MapStyleConfig` layer |
| Geo | Turf.js | distance, simplify, bearing |
| State | Zustand (client), TanStack Query (server) | |
| Validation | Zod | shared client/server schemas |
| Offline | Dexie (IndexedDB) | source of truth while recording |
| PWA | Serwist | `next-pwa` is largely unmaintained |
| Backend | Supabase (Auth, Postgres, Storage) | RLS on every table |
| Video | Canvas + MediaRecorder / WebCodecs | client-side, free; no Remotion needed |
| Testing | Vitest, Playwright | simulated GPS in CI |
| CI/CD | GitHub Actions → Vercel previews | |
| Monitoring | Sentry free tier | |

**Data-path rule:** the client talks to Supabase directly under RLS for CRUD. Route handlers are used only for privileged operations (publish sanitization, export bookkeeping, account deletion). Do not duplicate CRUD in both.

---

## 4. Architecture

```text
Browser
 ├─ Location Engine (watchPosition → validate → smooth)
 ├─ Journey State Machine (persisted in IndexedDB)
 ├─ Dexie: points + journey state (offline source of truth)
 ├─ Sync Worker (batched, idempotent)
 ├─ MapLibre (GeoJSON line + symbol layers, no DOM markers)
 ├─ Replay Engine (timestamp-driven)
 └─ Exporter (PNG / card / video via canvas)
            │
            ▼
Supabase: Auth · Postgres(+PostGIS optional) · Storage (RLS)
```

Suggested layout:

```text
src/
├── app/            # routes
├── features/       # location, journeys, replay, export, import, sharing
├── lib/            # supabase, maps, geo, storage, validation
├── components/     # map, recorder, replay, ui
└── types/
```

---

## 5. GPS Engine

```ts
type GPSPoint = {
  latitude: number
  longitude: number
  altitude: number | null   // browsers return null; GPS altitude is noisy
  accuracy: number | null
  speed: number | null
  heading: number | null
  timestamp: number         // use position.timestamp, not Date.now()
  segment: number           // increments on resume; gaps are never drawn or counted
}
```

### Validation: reject a point if
- lat/lng out of range, or timestamp invalid or non-monotonic
- accuracy worse than threshold (default 50 m; configurable)
- implied speed exceeds the mode's limit (walk 15, bike 40, car 200, plane 1000 km/h)
- jump distance is implausible for the elapsed time
- duplicate or sub-threshold movement while stationary (jitter suppression)

### Processing
1. Validate
2. Light smoothing (simple Kalman or moving average on low-accuracy points)
3. Stationary detection (speed + movement radius) to suppress jitter and avoid distance inflation
4. Append to Dexie, then update the live route

**Elevation:** don't trust GPS altitude. Optionally sample a free DEM later; for MVP, omit elevation gain or label it "approximate".

### State machine

```text
IDLE → STARTING → RECORDING ⇄ PAUSED
                    │  ↑
                    ▼  │
               GPS_LOST (auto-recovers)
RECORDING/PAUSED → FINISHING → COMPLETED
```

- The state is persisted on every transition; on app load, an unfinished journey offers **Resume or Finish**.
- A journey with no new points for N hours is flagged for auto-finish on next open.
- Pause creates a new `segment`.

---

## 6. Offline-First Sync (key resume feature)

- `journey.id` is a **client-generated UUID**; the journey exists locally before the server knows it.
- Each point has a per-journey `seq`; the server **upserts on `(journey_id, seq)`**, so retries are safe.
- Sync worker: batch (e.g. 100–500 points) → validate (Zod) → upload → on ack, mark synced.
- Retry with exponential backoff for transient errors; never retry permanent validation errors.
- Background Sync is unavailable on iOS; sync on `online`, on app focus, and on finish.
- Never delete local data until the server acknowledges **and** the journey is finalized.
- Test: kill the network mid-journey; refresh; recover; verify zero lost points and zero duplicates.

---

## 7. Data Model

Do **not** store one DB row per GPS point at scale (free 500 MB limit). Store compact per-journey data.

```text
profiles(id, display_name, created_at)

journeys(
  id uuid pk (client-generated), user_id, title, status,
  visibility ('private'|'unlisted'|'public'), share_token,
  travel_mode, vehicle, started_at, ended_at,
  distance_m, duration_s, moving_time_s,
  raw_track   -- compressed/encoded array of points (jsonb or polyline+timestamps)
  display_geometry  -- simplified LineString for rendering
  style jsonb   -- map_style, route_style, width, effect, camera
  created_at
)

journey_media(id, journey_id, storage_path, lat, lng, captured_at)  -- post-MVP if time allows

journey_public(journey_id, geometry_public, title, distance_m, duration_s, ...)
  -- server-generated, privacy-trimmed; the ONLY thing public/unlisted readers can see
```

**Rules**
- `raw_track` is never exposed to anyone but the owner.
- `display_geometry` is derived (Douglas–Peucker via `turf.simplify`); the raw track is never overwritten.
- Index `user_id`, `share_token`.

---

## 8. Security & Privacy (real users → keep this tight)

- **Private by default.**
- **RLS on every table**: owners read/write only their own rows.
- Public/unlisted readers query `journey_public` only (generated on publish).
- **Privacy trimming** on publish: hide first/last N meters (or user-chosen), round coordinates, optionally drop timestamps.
- **Unlisted links** use an unguessable random token (≥128-bit), not the journey ID.
- **Strip EXIF GPS** from any uploaded photo before storing.
- Storage buckets private; signed URLs for media and exports.
- Admin ability, if ever needed, via a server-side role in `app_metadata`, never `user_metadata` or a client flag.
- **Delete all my data** removes journeys, media, exports (storage objects included) and the account.
- Service-role key is server-only; never in `NEXT_PUBLIC_*`.
- Rate-limit publish/export endpoints (Upstash free tier or a simple per-user counter).
- One-paragraph **privacy notice** in-app: what is collected, who can see it, how to delete it.
- Driving notice on the record screen: "Don't use while driving; start before you go."

---

## 9. Replay Engine

- Reconstruct from timestamps: `position(t)` by interpolating between points; `routeProgress(t)` grows the drawn line.
- Skip or fast-forward long pauses and segment gaps.
- Speeds: 1×, 2×, 5×, 10×; scrub bar.
- Vehicle rotation from bearing (smoothed); camera modes: follow, overview.
- Render the route as a **GeoJSON line layer** and the vehicle as a **symbol layer**, never thousands of DOM markers.
- `prefers-reduced-motion`: show the static route plus a progress slider.

---

## 10. Styles

- `MapStyleConfig`: `{ id, name, styleUrl, provider }` so the provider is swappable.
- MVP map styles: Light, Dark, Minimal.
- MVP route styles: Classic, Neon (glow via layered lines), Gradient (`line-gradient` on a `lineMetrics` source), Dashed.
- Route style is independent of map style.
- Vehicles: `{ id, asset, scale, rotationOffset, modes }`; start with walking, bicycle, car, bus.

---

## 11. Export

| Output | Method | Notes |
|---|---|---|
| PNG | MapLibre canvas (`preserveDrawingBuffer`) + overlay | Include route, title, stats |
| Journey card | Canvas composition | Route, title, distance, duration, date, mode |
| Video | Frame-step the replay → canvas → MediaRecorder or WebCodecs + mp4 muxer | 9:16 first; add 1:1 / 16:9 later |

- Export never mutates original data.
- Check tile provider terms permit exporting rendered map imagery; attribute properly (include OSM/provider attribution in the export footer).
- Feature-detect; if video isn't supported, offer PNG + replay link.
- Cap video length and resolution (e.g. 1080×1920, ≤ 60 s) to keep memory safe on phones.

---

## 12. Error Handling & UX Copy

Every failure answers: what happened, is my data safe, what happens next, can I retry.

| Situation | Copy |
|---|---|
| Permission denied | "Location access is needed to record. You can still import a GPX file." |
| Offline | "You're offline. Your journey is saved on this device and will sync automatically." |
| Save failed | "We couldn't save this journey. Your points are still on this device. We'll retry." |
| Video unsupported | "Video export isn't supported on this browser yet. You can export an image instead." |

API envelope: `{ success, data, error: { code, message } }`. Never return raw DB errors. Log diagnostics without secrets or coordinates.

---

## 13. Performance

- Lazy-load map and exporter (dynamic imports).
- Batch DB writes in Dexie; throttle UI updates (about 1 Hz for stats).
- Simplify only the display geometry.
- Paginate journey lists; avoid loading raw tracks in list views.
- Reduce animation work when the page is hidden.

---

## 14. Testing

- **Unit (Vitest):** distance, validation, smoothing, simplification, bearing, segment handling, sync idempotency.
- **Integration:** RLS policies (owner vs other user vs anon), publish privacy trimming, share-token access.
- **E2E (Playwright):** simulated geolocation → start → pause → resume → finish → replay → PNG export; network-offline mid-journey recovery.
- **Manual device matrix:** one real iOS Safari and one Android Chrome pass before sharing with testers.
- CI: lint → typecheck → unit → build → E2E → Vercel preview. Don't merge red.

---

## 15. Debugging Checklists

**GPS:** permission → HTTPS → device location on → watcher registered → points arriving → passing validation → written to Dexie → sync running.

**Route not rendering:** valid GeoJSON → `[lng, lat]` order → map and style loaded → source/layer exist → geometry non-empty.

**Video failing:** journey and geometry valid → canvas size within limits → codec supported → memory/time cap → error logged.

Dev-only debug overlay: accuracy, speed, heading, points, sync %, network, FPS.

---

## 16. Build Plan

| Phase | Deliverable | Done when |
|---|---|---|
| 1. Foundation | Next.js, TS, Tailwind, MapLibre base, Supabase project, RLS skeleton | Map renders; auth works |
| 2. Import & Replay | GPX parse, display geometry, replay engine, styles | Imported GPX replays smoothly |
| 3. Export | PNG, journey card, video (9:16) | Share-ready output from imported data |
| 4. Recording | Location engine, state machine, Dexie, wake lock | Live journey survives refresh |
| 5. Sync & Save | Idempotent sync, journey list, delete | Offline test passes |
| 6. Sharing & Privacy | `journey_public`, unlisted token, trimming, delete-all-data | RLS tests pass |
| 7. Polish & Tester Release | PWA install, error copy, README, demo video, 10+ testers | Real-user feedback logged |

Phases 2–3 come before 4 on purpose: they validate the differentiator (replay and video) using GPX data, before solving live-tracking edge cases.

---

## 17. Real-User Validation (resume evidence)

Track privacy-safe events only (no coordinates): `journey_started`, `journey_completed`, `gpx_imported`, `replay_started`, `export_completed`, `share_link_created`, `sync_failed`, `sync_recovered`.

Metrics to report:
- number of testers and journeys
- completion rate (started → finished)
- sync success rate and recovered-after-offline count
- export success rate by browser
- median journey points and simplification ratio

Collect a short feedback form (3 questions) and include 2–3 quotes in the README.

---

## 18. Definition of Done

- [ ] GPS points are validated and smoothed
- [ ] Offline points are preserved; sync is idempotent
- [ ] Journey survives refresh and app kill
- [ ] Pause/resume doesn't draw or count gaps
- [ ] Replay and exports work on iOS Safari and Android Chrome
- [ ] Private journeys are provably private (RLS tests)
- [ ] Exports never alter the original data
- [ ] Delete-all-data removes DB rows and storage objects
- [ ] Every error path has friendly copy
- [ ] README, live demo, architecture diagram, 30-second demo video

---

## 19. README / Portfolio Checklist

- One-line pitch plus GIF of a replay
- Live demo link and test account or guest mode
- Architecture diagram (section 4)
- **Decisions and tradeoffs:** why client-side video, why guest-first, why raw vs display geometry, why idempotent sync, why not native yet
- **Known limitations** (section 2), stated plainly
- **Future work:** native wrapper (Capacitor + background geolocation), photo timeline, challenges, terrain
- Real-user results (section 17)

### Resume bullet template

> Built **GeoDraw**, an offline-first PWA (Next.js, TypeScript, MapLibre, Supabase) that turns GPS tracks into animated replays and exportable videos; implemented idempotent offline sync, GPS noise filtering, and client-side canvas video rendering; tested with *N* users across *M* journeys with *X*% sync success.

---

## 20. Golden Rules

1. Privacy first; private by default
2. Never lose journey data
3. Offline-first recording; idempotent sync
4. Keep raw GPS separate from display geometry
5. Keep map/storage providers replaceable
6. Validate all server input; RLS everywhere
7. Map is the hero; animation communicates, not distracts
8. Finish the MVP before adding anything
9. Be honest about limitations
10. Measure before optimizing
