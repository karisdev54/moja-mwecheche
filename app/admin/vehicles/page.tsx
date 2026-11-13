"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import PlateBadge from "@/components/PlateBadge";
import { Empty, Icon, PageHeader, PersonRow, Pill, Stat } from "@/components/AdminUI";
import { alertDialog, confirmDialog, promptDialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { fetchAvatars } from "@/lib/avatars";

type Doc = { type: string; path: string; url: string; expires: string | null; days: number | null };
type Car = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  car_plate: string | null;
  car_details: string | null;
  avatar: string | null;
  docs: Doc[];
};
type State = { allowed: boolean; cars: Car[] };

const LABEL: Record<string, { label: string; icon: string }> = {
  logbook: { label: "Logbook or sales agreement", icon: "doc" },
  car_photo: { label: "Plate photo", icon: "car" },
  insurance: { label: "Insurance", icon: "shield" },
  inspection: { label: "NTSA inspection", icon: "verify" },
  psv_badge: { label: "PSV badge", icon: "idcard" },
};

const CHECKS = [
  "The plate on the logbook or agreement matches the plate shown above",
  "The photo shows the same registration plate on the car",
  "The owner's name matches the account",
  "Insurance and the NTSA inspection report are current, with a sensible expiry date",
  "For drivers: the PSV badge is valid and in the driver's name",
];

async function fetchCars(): Promise<State> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { allowed: false, cars: [] };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "admin") return { allowed: false, cars: [] };
    
  const { data } = await supabase.rpc("admin_pending_cars");
  const rows = (data ?? []) as Omit<Car, "docs">[];
  if (rows.length === 0) return { allowed: true, cars: [] };
  const av = await fetchAvatars(rows.map((r) => r.id))
  
  const { data: docs } = await supabase
    .from("car_documents")
    .select("user_id,doc_type,file_path,expires_on,created_at")
    .in("user_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });
  const list = (docs ?? []) as { user_id: string; doc_type: string; file_path: string; expires_on: string | null }[];

  const urls = new Map<string, string>();
  if (list.length > 0) {
    const signed = await supabase.storage.from("driver-docs").createSignedUrls(list.map((d) => d.file_path), 900);
    (signed.data ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    });
  }

  return {
    allowed: true,
    cars: rows.map((r) => {
      const latest = new Map<string, { path: string; expires: string | null }>();
      list.filter((d) => d.user_id === r.id).forEach((d) => latest.set(d.doc_type, { path: d.file_path, expires: d.expires_on }));
      return {
        ...r,
        docs: [...latest.entries()].map(([type, v]) => ({
          type,
          path: v.path,
          url: urls.get(v.path) ?? "",
          avatar: av[r.id] ?? null,
          expires: v.expires,
          days: v.expires ? Math.ceil((new Date(`${v.expires}T00:00:00`).getTime() - Date.now()) / 86400000) : null,
        })),
      };
    }),
  };
}

export default function VehiclesPage() {
  const [state, setState] = useState<State | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCars().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const decide = async (c: Car, approve: boolean) => {
    let reason: string | null = null;
    if (!approve) {
      reason = await promptDialog({
        title: "Reject this vehicle?",
        message: "The owner will see this reason and can upload again.",
        placeholder: "For example: the plate on the photo does not match the logbook",
        multiline: true,
        required: true,
        minLength: 5,
        confirmText: "Reject",
        danger: true,
      });
      if (reason === null) return;
    } else {
      const ok = await confirmDialog({
        title: "Approve this vehicle?",
        message: "A verified tick will show next to the plate, and the owner can use the car on jobs.",
        confirmText: "Approve",
      });
      if (!ok) return;
    }
    setBusyId(c.id);
    const { error } = await supabase.rpc("admin_review_car", { p_user: c.id, p_approve: approve, p_reason: reason });
    setBusyId(null);
    if (error) {
      await alertDialog({ title: "Could not save", message: error.message });
      return;
    }
    toast(approve ? "Vehicle approved" : "Vehicle rejected", { tone: approve ? "ok" : "warn" });
    fetchCars().then(setState);
  };

  if (!state) return <Loader full />;
  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Vehicles" subtitle="Check documents, plates and expiry dates" />
        <AdminNav />

        <div className="grid grid-cols-2 gap-3">
          <Stat icon="car" color="#d97706" label="Waiting for review" value={state.cars.length} />
          <Stat icon="doc" color="#6366f1" label="Documents to check" value={state.cars.reduce((s, c) => s + c.docs.length, 0)} />
        </div>

        {state.cars.length === 0 && <Empty icon="check" title="All caught up" text="No vehicles are waiting for approval." />}

        {state.cars.map((c, i) => (
          <article
            key={c.id}
            className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <div className="w-1.5 shrink-0" style={{ background: "#d97706" }} />
            <div className="flex-1 min-w-0 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Plate typed by the owner</p>
                  <PlateBadge plate={c.car_plate} />
                  {c.car_details && <p className="text-sm text-gray-800">{c.car_details}</p>}
                </div>
                <Pill text="Pending" color="#d97706" />
              </div>

              <PersonRow role={c.role === "driver" ? "Driver" : "Customer"} name={c.full_name} phone={c.phone} avatar={c.avatar}>
                <p className="text-xs text-gray-700 truncate">{c.email}</p>
              </PersonRow>

              <div className="grid grid-cols-2 gap-2">
                {c.docs.map((d) => {
                  const meta = LABEL[d.type] ?? { label: d.type, icon: "doc" };
                  const img = /\.(jpe?g|png|webp|gif)$/i.test(d.path);
                  const warn = d.days !== null && d.days < 30;
                  const inner = (
                    <>
                      {img && d.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.url} alt={meta.label} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="text-indigo-600">
                          <Icon name={meta.icon} className="w-8 h-8" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[11px] font-bold px-2 py-1.5">
                        <span className="flex items-center gap-1.5">
                          <Icon name={meta.icon} className="w-3.5 h-3.5" />
                          {meta.label}
                        </span>
                        {d.expires && (
                          <span className={`block font-semibold ${warn ? "text-red-300" : "text-white/80"}`}>
                            Expires {new Date(`${d.expires}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" })}
                          </span>
                        )}
                      </span>
                    </>
                  );
                  const cls = "relative aspect-[4/3] rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100 flex items-center justify-center active:scale-95";
                  return d.url ? (
                    <a key={d.type} href={d.url} target="_blank" rel="noreferrer" className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <div key={d.type} className={cls}>
                      {inner}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl bg-indigo-50 p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Before you approve</p>
                {CHECKS.map((t) => (
                  <p key={t} className="flex items-start gap-2 text-xs text-gray-800">
                    <span className="text-indigo-600 mt-0.5">
                      <Icon name="tick" className="w-3.5 h-3.5" />
                    </span>
                    {t}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => decide(c, true)}
                  disabled={busyId === c.id}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl p-3.5 disabled:opacity-50 active:scale-95"
                >
                  <Icon name="check" className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => decide(c, false)}
                  disabled={busyId === c.id}
                  className="flex items-center justify-center gap-2 bg-white border-2 border-red-300 text-red-700 font-bold rounded-xl p-3.5 disabled:opacity-50 active:scale-95"
                >
                  <Icon name="close" className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}