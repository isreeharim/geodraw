'use client';

import React, { useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  GeoJSONSource,
} from 'maplibre-gl';
import { CameraMode, GPSPoint, MapStyleId, RouteStyleId, VehicleType } from '@/types';
import { MAP_STYLES, ROUTE_STYLES } from '@/lib/maps/styles';

interface MapViewProps {
  mapStyle: MapStyleId;
  routeStyle: RouteStyleId;
  vehicle: VehicleType;
  cameraMode: CameraMode;
  drawnGeometry: GeoJSON.LineString | GeoJSON.MultiLineString | null;
  fullTrack: GPSPoint[] | null;
  currentVehiclePos: { lng: number; lat: number; heading: number } | null;
  onMapLoaded?: (map: MapLibreMap) => void;
}

export function MapView({
  mapStyle,
  routeStyle,
  cameraMode,
  drawnGeometry,
  fullTrack,
  currentVehiclePos,
  onMapLoaded,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef(false);
  const onMapLoadedRef = useRef(onMapLoaded);
  useEffect(() => {
    onMapLoadedRef.current = onMapLoaded;
  }, [onMapLoaded]);

  const initMapStyleRef = useRef(mapStyle);
  const initRouteStyleRef = useRef(routeStyle);

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleConfig = MAP_STYLES[initMapStyleRef.current] || MAP_STYLES.light;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleConfig.styleUrl,
      center: [-122.4194, 37.7749], // SF default
      zoom: 13,
      pitch: 40,
      canvasContextAttributes: {
        preserveDrawingBuffer: true,
      },
      attributionControl: false,
    });

    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: '© OpenFreeMap • © OpenStreetMap contributors',
      }),
      'bottom-right'
    );

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      isMapLoadedRef.current = true;
      mapRef.current = map;

      // 1. Full faint background track source
      map.addSource('full-route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'full-route-layer',
        type: 'line',
        source: 'full-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#94a3b8',
          'line-width': 3,
          'line-opacity': 0.35,
          'line-dasharray': [2, 2],
        },
      });

      // 2. Animated drawn route source & layers
      map.addSource('drawn-route-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Glow layer for neon style
      map.addLayer({
        id: 'route-glow-layer',
        type: 'line',
        source: 'drawn-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ROUTE_STYLES[initRouteStyleRef.current].secondaryColor || '#ff4d4f66',
          'line-width': 14,
          'line-opacity': initRouteStyleRef.current === 'neon' ? 0.7 : 0,
          'line-blur': 6,
        },
      });

      // Core route line
      map.addLayer({
        id: 'drawn-route-layer',
        type: 'line',
        source: 'drawn-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ROUTE_STYLES[initRouteStyleRef.current].color,
          'line-width': ROUTE_STYLES[initRouteStyleRef.current].width,
          'line-dasharray': initRouteStyleRef.current === 'dashed' ? [2, 2] : [1, 0],
        },
      });

      // 3. Vehicle source & layer
      map.addSource('vehicle-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Vehicle outer pulse circle
      map.addLayer({
        id: 'vehicle-pulse-layer',
        type: 'circle',
        source: 'vehicle-source',
        paint: {
          'circle-radius': 16,
          'circle-color': '#ff4d4f',
          'circle-opacity': 0.25,
        },
      });

      // Vehicle center marker
      map.addLayer({
        id: 'vehicle-marker-layer',
        type: 'circle',
        source: 'vehicle-source',
        paint: {
          'circle-radius': 8,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#ff4d4f',
          'circle-stroke-width': 3,
        },
      });

      if (onMapLoadedRef.current) onMapLoadedRef.current(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      isMapLoadedRef.current = false;
    };
  }, []);

  // Update Map Style URL when user changes style
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const styleConfig = MAP_STYLES[mapStyle];
    if (styleConfig) {
      map.setStyle(styleConfig.styleUrl);
    }
  }, [mapStyle]);

  // Update Route Style colors / widths
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const style = ROUTE_STYLES[routeStyle];
    if (!style) return;

    if (map.getLayer('drawn-route-layer')) {
      map.setPaintProperty('drawn-route-layer', 'line-color', style.color);
      map.setPaintProperty('drawn-route-layer', 'line-width', style.width);
      map.setPaintProperty(
        'drawn-route-layer',
        'line-dasharray',
        style.dashed ? [2, 2] : [1, 0]
      );
    }

    if (map.getLayer('route-glow-layer')) {
      map.setPaintProperty(
        'route-glow-layer',
        'line-color',
        style.secondaryColor || style.color
      );
      map.setPaintProperty(
        'route-glow-layer',
        'line-opacity',
        style.glow ? 0.75 : 0
      );
    }
  }, [routeStyle]);

  // Update Full Track background preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current || !fullTrack || fullTrack.length < 2) return;

    const source = map.getSource('full-route-source') as GeoJSONSource;
    if (!source) return;

    const lineCoords = fullTrack.map((p) => [p.longitude, p.latitude]);
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
    });

    // Fit bounds on first track load if overview
    if (cameraMode === 'overview') {
      const lats = fullTrack.map((p) => p.latitude);
      const lngs = fullTrack.map((p) => p.longitude);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 1000 }
      );
    }
  }, [fullTrack, cameraMode]);

  // Update Drawn Animated Route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const source = map.getSource('drawn-route-source') as GeoJSONSource;
    if (!source) return;

    if (!drawnGeometry) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'Feature',
      properties: {},
      geometry: drawnGeometry,
    });
  }, [drawnGeometry]);

  // Update Vehicle position & follow camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const source = map.getSource('vehicle-source') as GeoJSONSource;
    if (!source) return;

    if (!currentVehiclePos) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'Feature',
      properties: { heading: currentVehiclePos.heading },
      geometry: {
        type: 'Point',
        coordinates: [currentVehiclePos.lng, currentVehiclePos.lat],
      },
    });

    // Follow Camera mode
    if (cameraMode === 'follow') {
      map.easeTo({
        center: [currentVehiclePos.lng, currentVehiclePos.lat],
        bearing: currentVehiclePos.heading || map.getBearing(),
        duration: 120,
        easing: (t) => t,
      });
    }
  }, [currentVehiclePos, cameraMode]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
