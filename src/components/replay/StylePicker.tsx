'use client';

import React from 'react';
import { MapStyleId, RouteStyleId, VehicleType } from '@/types';
import { MAP_STYLES, ROUTE_STYLES, VEHICLE_CONFIGS } from '@/lib/maps/styles';
import { X, Sliders } from 'lucide-react';

interface StylePickerProps {
  currentMapStyle: MapStyleId;
  currentRouteStyle: RouteStyleId;
  currentVehicle: VehicleType;
  onSelectMapStyle: (style: MapStyleId) => void;
  onSelectRouteStyle: (style: RouteStyleId) => void;
  onSelectVehicle: (vehicle: VehicleType) => void;
  onClose?: () => void;
}

export function StylePicker({
  currentMapStyle,
  currentRouteStyle,
  currentVehicle,
  onSelectMapStyle,
  onSelectRouteStyle,
  onSelectVehicle,
  onClose,
}: StylePickerProps) {
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex flex-col gap-3.5 text-xs animate-in fade-in duration-150">
      {/* Header with Title & Close button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Sliders className="w-3.5 h-3.5 text-rose-400" />
          <span>Style Customizer</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Map Styles */}
      <div>
        <span className="text-slate-400 font-medium block mb-1.5 text-[11px]">Map Theme</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => {
            const isSelected = currentMapStyle === id;
            return (
              <button
                key={id}
                onClick={() => onSelectMapStyle(id)}
                className={`py-1.5 px-2 rounded-xl border text-center font-medium capitalize transition active:scale-95 ${
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
        <span className="text-slate-400 font-medium block mb-1.5 text-[11px]">Route Aesthetic</span>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(ROUTE_STYLES) as RouteStyleId[]).map((id) => {
            const style = ROUTE_STYLES[id];
            const isSelected = currentRouteStyle === id;
            return (
              <button
                key={id}
                onClick={() => onSelectRouteStyle(id)}
                className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl border text-left font-medium transition active:scale-95 ${
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
        <span className="text-slate-400 font-medium block mb-1.5 text-[11px]">Vehicle Avatar</span>
        <div className="flex items-center justify-between gap-1">
          {(Object.keys(VEHICLE_CONFIGS) as VehicleType[]).map((id) => {
            const v = VEHICLE_CONFIGS[id];
            const isSelected = currentVehicle === id;
            return (
              <button
                key={id}
                onClick={() => onSelectVehicle(id)}
                className={`flex-1 py-1.5 px-2 rounded-xl border text-center text-sm transition active:scale-95 ${
                  isSelected
                    ? 'border-rose-500 bg-rose-500/20 shadow-sm'
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
