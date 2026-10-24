"use client";
import { useEffect, useState } from "react";
import { searchPlaces, type LngLat, type Place } from "@/lib/mapbox";

export default function PlaceSearch({
  value,
  picked,
  near,
  onTextChange,
  onPick,
}: {
  value: string;
  picked: boolean;
  near?: LngLat;
  onTextChange: (v: string) => void;
  onPick: (p: Place) => void;
}) {
  const [items, setItems] = useState<Place[]>([]);
  const nearLng = near?.[0];
  const nearLat = near?.[1];

  useEffect(() => {
    if (picked || value.trim().length < 3) return;
    let active = true;
    const t = setTimeout(() => {
      const proximity: LngLat | undefined =
        nearLng !== undefined && nearLat !== undefined ? [nearLng, nearLat] : undefined;
      searchPlaces(value, proximity).then((r) => {
        if (active) setItems(r);
      });
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [value, picked, nearLng, nearLat]);

  const list = !picked && value.trim().length >= 3 ? items : [];

  return (
    <div className="relative">
      <input
        className="w-full border-2 border-indigo-200 rounded-lg p-3 pr-10"
        placeholder="Search a place, e.g. JKIA, Westlands..."
        value={value}
        onChange={(e) => onTextChange(e.target.value)}
      />
      {picked && <span className="absolute right-3 top-3 text-green-600 font-bold">✓</span>}
      {list.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border-2 border-indigo-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {list.map((p, i) => (
            <li key={`${p.address}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  onPick(p);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-indigo-50 border-b last:border-b-0"
              >
                <span className="font-semibold">{p.name}</span>
                <span className="block text-xs text-gray-700">{p.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}