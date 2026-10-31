"use client";
import { useEffect, useRef, useState } from "react";
import { retrievePlace, suggestPlaces, type LngLat, type Place, type Suggestion } from "@/lib/mapbox";

const KIND: Record<string, string> = {
  poi: "Landmark",
  address: "Address",
  street: "Street",
  neighborhood: "Area",
  locality: "Town",
  place: "Town",
};

function ensure(ref: { current: string }) {
  if (!ref.current) ref.current = crypto.randomUUID();
  return ref.current;
}

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
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const session = useRef("");
  const nearLng = near?.[0];
  const nearLat = near?.[1];

  useEffect(() => {
    if (picked || value.trim().length < 3) return;
    let active = true;
    const t = setTimeout(() => {
      const prox: LngLat | undefined =
        nearLng !== undefined && nearLat !== undefined ? [nearLng, nearLat] : undefined;
      suggestPlaces(value, ensure(session), prox).then((r) => {
        if (active) setItems(r);
      });
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [value, picked, nearLng, nearLat]);

  const choose = async (s: Suggestion) => {
    setBusy(true);
    setErr("");
    const p = await retrievePlace(s.id, ensure(session));
    setBusy(false);
    if (!p) {
      setErr("Could not load that place. Try another, or choose it on the map.");
      return;
    }
    setItems([]);
    session.current = ""; // the next search starts a fresh session
    onPick(p);
  };

  const list = !picked && value.trim().length >= 3 ? items : [];

  return (
    <div className="relative">
      <input
        className="w-full border-2 border-indigo-200 rounded-lg p-3 pr-10"
        placeholder="Search a landmark, mall, estate or street..."
        value={value}
        onChange={(e) => onTextChange(e.target.value)}
      />
      {picked && <span className="absolute right-3 top-3 text-green-600 font-bold">✓</span>}
      {busy && <p className="text-xs mt-1">Loading place...</p>}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      {list.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border-2 border-indigo-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {list.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => choose(s)}
                className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-indigo-50 border-b last:border-b-0"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-[10px] font-bold uppercase text-indigo-700">{KIND[s.kind] ?? ""}</span>
                </span>
                <span className="block text-xs text-gray-700">{s.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}