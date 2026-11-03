"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import Loader from "@/components/Loader";
import CarFields, { emptyCar, type CarState } from "@/components/CarFields";
import { formatPlate, friendlyDbError, normalizePlate, plateProblem } from "@/lib/validate";

async function fetchCar(): Promise<{ role: string; saved: CarState } | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("role,has_car,car_plate,car_details")
    .eq("id", u.user.id)
    .maybeSingle();
  return {
    role: p?.role ?? "customer",
    saved: { has: p?.has_car ?? null, plate: formatPlate(p?.car_plate), details: p?.car_details ?? "" },
  };
}

export default function CarPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<CarState>(emptyCar);
  const [car, setCar] = useState<CarState>(emptyCar);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let active = true;
    fetchCar().then((r) => {
      if (!active) return;
      if (!r) return router.replace("/login");
      if (r.role === "admin") return router.replace("/profile");
      setSaved(r.saved);
      setCar(r.saved);
      setEditing(r.saved.has === null); // never answered: open for editing straight away
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const save = async () => {
    if (busy) return;
    setMsg("");
    if (car.has === null) return setMsg("Tell us if you have a car.");
    if (car.has) {
      const p = plateProblem(car.plate);
      if (p) return setMsg(p);
    }

    setBusy(true);
    const { error } = await supabase.rpc("update_my_car", {
      p_has_car: car.has,
      p_plate: car.has ? normalizePlate(car.plate) : null,
      p_car: car.has ? car.details.trim() || null : null,
    });
    if (error) {
      setBusy(false);
      return setMsg(friendlyDbError(error.message, error.code));
    }
    const fresh = await fetchCar();
    setBusy(false);
    if (fresh) {
      setSaved(fresh.saved);
      setCar(fresh.saved);
    }
    setEditing(false);
    setOk("Car updated ✓");
    setTimeout(() => setOk(""), 5000);
  };

  const cancel = () => {
    setCar(saved);
    setMsg("");
    setEditing(false);
  };

  if (!loaded) return <Loader full />;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4 text-gray-900 stagger">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My car</h1>
          <Link href="/profile" className="text-sm underline font-semibold">Back</Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="text-sm">
            {editing
              ? "Changes are checked and recorded for safety. You cannot change your car during a job."
              : "This is the car on record. Your plate is shown during a job so people can find the right car."}
          </p>

          <fieldset disabled={!editing} className={`min-w-0 ${editing ? "" : "opacity-70"}`}>
            <CarFields value={car} onChange={setCar} />
          </fieldset>

          {ok && <p className="text-green-700 text-sm font-semibold">{ok}</p>}
          {msg && <p className="text-red-600 text-sm font-semibold">{msg}</p>}

          {!editing ? (
            <button
              onClick={() => {
                setOk("");
                setEditing(true);
              }}
              className="w-full bg-indigo-600 text-white font-bold rounded-lg p-3"
            >
              ✏️ I got a new car or need to change details
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 bg-indigo-600 text-white font-bold rounded-lg p-3 disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save car"}
              </button>
              {saved.has !== null && (
                <button
                  onClick={cancel}
                  disabled={busy}
                  className="flex-1 bg-white border-2 border-indigo-200 font-semibold rounded-lg p-3"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}