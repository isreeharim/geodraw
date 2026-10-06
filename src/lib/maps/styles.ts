import { MapStyleConfig, MapStyleId, RouteStyleId, VehicleConfig } from '@/types';

export const MAP_STYLES: Record<MapStyleId, MapStyleConfig> = {
  light: {
    id: 'light',
    name: 'Clean Light',
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    provider: 'OpenFreeMap',
  },
  dark: {
    id: 'dark',
    name: 'Midnight Dark',
    styleUrl: 'https://tiles.openfreemap.org/styles/dark',
    provider: 'OpenFreeMap',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalist Liberty',
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    provider: 'OpenFreeMap',
  },
};

export const ROUTE_STYLES: Record<
  RouteStyleId,
  {
    id: RouteStyleId;
    name: string;
    color: string;
    secondaryColor?: string;
    width: number;
    glow?: boolean;
    dashed?: boolean;
  }
> = {
  classic: {
    id: 'classic',
    name: 'Classic Coral',
    color: '#ff4d4f',
    width: 5,
  },
  neon: {
    id: 'neon',
    name: 'Cyber Neon Glow',
    color: '#00f6ff',
    secondaryColor: '#00f6ff66',
    width: 6,
    glow: true,
  },
  gradient: {
    id: 'gradient',
    name: 'Sunset Gradient',
    color: '#ff5e62',
    secondaryColor: '#ff9966',
    width: 6,
  },
  dashed: {
    id: 'dashed',
    name: 'Explorer Dashed',
    color: '#10b981',
    width: 4,
    dashed: true,
  },
};

export const VEHICLE_CONFIGS: Record<string, VehicleConfig> = {
  walk: {
    id: 'walk',
    name: 'Walker / Runner',
    icon: '🚶',
    scale: 1,
    rotationOffset: 0,
    modes: ['walk'],
  },
  bike: {
    id: 'bike',
    name: 'Bicycle',
    icon: '🚲',
    scale: 1.1,
    rotationOffset: 0,
    modes: ['bike'],
  },
  car: {
    id: 'car',
    name: 'Automobile',
    icon: '🚗',
    scale: 1.2,
    rotationOffset: 0,
    modes: ['car'],
  },
  bus: {
    id: 'bus',
    name: 'Transit / Bus',
    icon: '🚌',
    scale: 1.3,
    rotationOffset: 0,
    modes: ['car'],
  },
  plane: {
    id: 'plane',
    name: 'Airplane',
    icon: '✈️',
    scale: 1.4,
    rotationOffset: 0,
    modes: ['plane'],
  },
};
