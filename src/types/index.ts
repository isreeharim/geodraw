export type TravelMode = 'walk' | 'bike' | 'car' | 'plane';

export type VehicleType = 'walk' | 'bike' | 'car' | 'bus' | 'plane';

export type RecorderState =
  | 'IDLE'
  | 'STARTING'
  | 'RECORDING'
  | 'PAUSED'
  | 'GPS_LOST'
  | 'FINISHING'
  | 'COMPLETED';

export type GPSPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null; // browsers return null; GPS altitude is noisy
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number; // use position.timestamp, not Date.now()
  segment: number; // increments on resume; gaps are never drawn or counted
};

export type StoredPoint = GPSPoint & {
  id?: number;
  journey_id: string;
  seq: number;
  synced: boolean;
};

export type MapStyleId = 'light' | 'dark' | 'minimal';
export type RouteStyleId = 'classic' | 'neon' | 'gradient' | 'dashed';
export type CameraMode = 'follow' | 'overview';

export type JourneyStyleConfig = {
  mapStyle: MapStyleId;
  routeStyle: RouteStyleId;
  lineWidth?: number;
  effect?: string;
  cameraMode?: CameraMode;
};

export type Journey = {
  id: string; // client-generated UUID
  user_id?: string | null;
  title: string;
  status: 'recording' | 'completed' | 'abandoned';
  visibility: 'private' | 'unlisted' | 'public';
  share_token?: string | null;
  travel_mode: TravelMode;
  vehicle: VehicleType;
  started_at: number;
  ended_at?: number | null;
  distance_m: number;
  duration_s: number;
  moving_time_s: number;
  raw_track: GPSPoint[];
  display_geometry?: GeoJSON.LineString | GeoJSON.MultiLineString | null;
  style: JourneyStyleConfig;
  created_at: number;
};

export type JourneyPublic = {
  journey_id: string;
  share_token: string;
  title: string;
  distance_m: number;
  duration_s: number;
  travel_mode: TravelMode;
  vehicle: VehicleType;
  started_at: number;
  display_geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
  style: JourneyStyleConfig;
};

export type MapStyleConfig = {
  id: MapStyleId;
  name: string;
  styleUrl: string;
  provider: string;
};

export type VehicleConfig = {
  id: VehicleType;
  name: string;
  icon: string;
  scale: number;
  rotationOffset: number;
  modes: TravelMode[];
};

export type ReplaySpeed = 1 | 2 | 5 | 10;

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
