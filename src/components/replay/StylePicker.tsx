'use client';

import React from 'react';
import { MapStyleId, RouteStyleId, VehicleType } from '@/types';
import { MAP_STYLES, ROUTE_STYLES, VEHICLE_CONFIGS } from '@/lib/maps/styles';

interface StylePickerProps {
  currentMapStyle: MapStyleId;
  currentRouteStyle: RouteStyleId;
  currentVehicle: VehicleType;
  onSelectMapStyle: (style: MapStyleId) => void;
  onSelectRouteStyle: (style: RouteStyleId) => void;
  onSelectVehicle: (vehicle: VehicleType) => void;
}

export function StylePicker({
  currentMapStyle,
  currentRouteStyle,
  currentVehicle,
  onSelectMapStyle,
  onSelectRouteStyle,
  onSelectVehicle,
}: StylePickerProps) {
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 text-white rounded-2xl p-4 shadow-xl flex flex-col gap-4 text-xs">
      {/* Map Styles */}
      <div>
        <span className="text-slate-400 font-medium block mb-2">Map Theme</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => {
            const isSelected = currentMapStyle === id;
            return (
              <button
                key={id}
                onClick={() => onSelectMapStyle(id)}
                className={`py-1.5 px-2 rounded-xl border text-center font-medium capitalize transition ${
                  isSelected
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Route Styles */}
      <div>
        <span className="text-slate-400 font-medium block mb-2">Route Aesthetic</span>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(ROUTE_STYLES) as RouteStyleId[]).map((id) => {
            const style = ROUTE_STYLES[id];
            const isSelected = currentRouteStyle === id;
            return (
              <button
                key={id}
                onClick={() => onSelectRouteStyle(id)}
                className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl border text-left font-medium transition ${
                  isSelected
                    ? 'border-rose-500 bg-rose-500/20 text-white'
                    : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: style.color }}
                />
                <span className="truncate capitalize">{id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vehicle / Travel Mode */}
      <div>
        <span className="text-slate-400 font-medium block mb-2">Vehicle</span>
        <div className="flex items-center justify-between gap-1">
          {(Object.keys(VEHICLE_CONFIGS) as VehicleType[]).map((id) => {
            const v = VEHICLE_CONFIGS[id];
            const isSelected = currentVehicle === id;
            return (
              <button
                key={id}
                onClick={() => onSelectVehicle(id)}
                className={`flex-1 py-1.5 px-2 rounded-xl border text-center text-sm transition ${
                  isSelected
                    ? 'border-rose-500 bg-rose-500/20 shadow'
                    : 'border-slate-800 bg-slate-800/60 opacity-60 hover:opacity-100'
                }`}
                title={v.name}
              >
                {v.icon}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
