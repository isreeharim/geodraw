'use client';

import React, { useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  AttributionControl,
  GeoJSONSource,
  Marker,
  setWorkerUrl,
} from 'maplibre-gl';
import { CameraMode, GPSPoint, MapStyleId, RouteStyleId, VehicleType } from '@/types';
import { MAP_STYLES, ROUTE_STYLES, VEHICLE_CONFIGS } from '@/lib/maps/styles';

if (typeof window !== 'undefined') {
  setWorkerUrl('/maplibre-gl-worker.mjs');
}

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
  vehicle,
  cameraMode,
  drawnGeometry,
  fullTrack,
  currentVehiclePos,
  onMapLoaded,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const isMapLoadedRef = useRef(false);
  const vehicleMarkerRef = useRef<Marker | null>(null);

  // Keep references to latest state for style reloading
  const routeStyleRef = useRef(routeStyle);
  const drawnGeometryRef = useRef(drawnGeometry);
  const fullTrackRef = useRef(fullTrack);

  useEffect(() => {
    routeStyleRef.current = routeStyle;
    drawnGeometryRef.current = drawnGeometry;
    fullTrackRef.current = fullTrack;
  }, [routeStyle, drawnGeometry, fullTrack]);

  const onMapLoadedRef = useRef(onMapLoaded);
  useEffect(() => {
    onMapLoadedRef.current = onMapLoaded;
  }, [onMapLoaded]);

  // Helper to attach custom GeoJSON sources and layers cleanly
  const setupLayers = (map: MapLibreMap) => {
    const curStyle = ROUTE_STYLES[routeStyleRef.current] || ROUTE_STYLES.classic;

    // 1. Background full track
    if (!map.getSource('full-route-source')) {
      const fullCoords = fullTrackRef.current
        ? fullTrackRef.current.map((p) => [p.longitude, p.latitude])
        : [];

      map.addSource('full-route-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: fullCoords,
          },
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
          'line-opacity': 0.3,
          'line-dasharray': [2, 2],
        },
      });
    }

    // 2. Animated drawn route
    if (!map.getSource('drawn-route-source')) {
      map.addSource('drawn-route-source', {
        type: 'geojson',
        lineMetrics: true, // Enables smooth line gradients
        data: drawnGeometryRef.current
          ? {
              type: 'Feature',
              properties: {},
              geometry: drawnGeometryRef.current,
            }
          : {
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
          'line-color': curStyle.secondaryColor || '#ff4d4f66',
          'line-width': 14,
          'line-opacity': curStyle.glow ? 0.75 : 0,
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
          'line-color': curStyle.color,
          'line-width': curStyle.width,
          'line-dasharray': curStyle.dashed ? [2, 2] : [1, 0],
        },
      });
    }
  };

  // Store initial values to safely initialize MapLibre once
  const initialMapStyleRef = useRef(mapStyle);
  const initialVehicleRef = useRef(vehicle);

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleConfig = MAP_STYLES[initialMapStyleRef.current] || MAP_STYLES.light;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleConfig.styleUrl,
      center: [-122.4194, 37.7749], // SF default
      zoom: 13,
      pitch: 40,
      canvasContextAttributes: {
        preserveDrawingBuffer: true, // Required for canvas PNG & video export
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

    // Create interactive animated vehicle marker DOM node
    const vehicleEl = document.createElement('div');
    vehicleEl.className = 'geodraw-vehicle-marker flex items-center justify-center';
    vehicleEl.style.width = '38px';
    vehicleEl.style.height = '38px';
    vehicleEl.style.borderRadius = '50%';
    vehicleEl.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    vehicleEl.style.border = '2.5px solid #ff4d4f';
    vehicleEl.style.boxShadow = '0 4px 14px rgba(255, 77, 79, 0.4)';
    vehicleEl.style.fontSize = '20px';
    vehicleEl.style.cursor = 'pointer';
    vehicleEl.style.transition = 'transform 0.1s linear';
    vehicleEl.innerHTML = VEHICLE_CONFIGS[initialVehicleRef.current]?.icon || '🚶';

    const vehicleMarker = new Marker({
      element: vehicleEl,
      anchor: 'center',
    });

    vehicleMarkerRef.current = vehicleMarker;

    map.on('load', () => {
      isMapLoadedRef.current = true;
      mapRef.current = map;

      setupLayers(map);
      vehicleMarker.addTo(map);

      if (onMapLoadedRef.current) onMapLoadedRef.current(map);
    });

    // Re-attach custom sources & layers whenever map theme changes
    map.on('style.load', () => {
      if (isMapLoadedRef.current) {
        setupLayers(map);
      }
    });

    return () => {
      vehicleMarker.remove();
      map.remove();
      mapRef.current = null;
      isMapLoadedRef.current = false;
      vehicleMarkerRef.current = null;
    };
  }, []);

  // Update Map Theme
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;
    const styleConfig = MAP_STYLES[mapStyle];
    if (styleConfig) {
      map.setStyle(styleConfig.styleUrl);
    }
  }, [mapStyle]);

  // Update Route Style (colors / glow / dash)
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

  // Update Vehicle Avatar Icon
  useEffect(() => {
    if (vehicleMarkerRef.current) {
      const el = vehicleMarkerRef.current.getElement();
      if (el) {
        el.innerHTML = VEHICLE_CONFIGS[vehicle]?.icon || '🚶';
      }
    }
  }, [vehicle]);

  // Update Full Track background path
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current || !fullTrack || fullTrack.length < 2) return;

    const source = map.getSource('full-route-source') as GeoJSONSource;
    if (source) {
      const lineCoords = fullTrack.map((p) => [p.longitude, p.latitude]);
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: lineCoords,
        },
      });
    }

    // Fit overview bounds on track load
    if (cameraMode === 'overview') {
      const lats = fullTrack.map((p) => p.latitude);
      const lngs = fullTrack.map((p) => p.longitude);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 800 }
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

  // Update Vehicle position & Follow Camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current || !currentVehiclePos) return;

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLngLat([currentVehiclePos.lng, currentVehiclePos.lat]);
      const el = vehicleMarkerRef.current.getElement();
      if (el) {
        // Rotate vehicle icon smoothly with heading
        el.style.transform = `rotate(${currentVehiclePos.heading || 0}deg)`;
      }
    }

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
