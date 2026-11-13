"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import PlateBadge from "@/components/PlateBadge";
import PhotoPicker from "@/components/PhotoPicker";
import CarFields, { emptyCar, type CarState } from "@/components/CarFields";
import { Icon, PageHeader, Pill, Tile } from "@/components/AdminUI";
import { compressImage } from "@/lib/image";
import { formatPlate, friendlyDbError, normalizePlate, plateProblem } from "@/lib/validate";
import { friendlyError } from "@/lib/net";
import { toast } from "@/lib/toast";

type Status = "unsubmitted" | "pending" | "approved" | "rejected" | "expired";
type Doc = { path: string; url: string; expires: string | null; days: number | null };
type Staged = { file: File; url: string | null; expires: string };
type Info = { uid: string; role: string; saved: CarState; status: Status; reason: string | null };

const MIN_DAYS = 7;
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DOCS = [
  { type: "logbook", label: "Logbook or sales agreement", hint: "Shows the plate number and the owner's name. A sales agreement works if you do not have the logbook yet.", icon: "doc", color: "#6366f1", expires: false, driverOnly: false },
  { type: "car_photo", label: "Photo showing the registration plate", hint: "The whole car, with the registration plate clearly visible", icon: "car", color: "#0ea5e9", expires: false, driverOnly: false },
  { type: "insurance", label: "Vehicle insurance", hint: "Your current insurance certificate", icon: "shield", color: "#10b981", expires: true, driverOnly: false },
  { type: "inspection", label: "NTSA inspection report", hint: "A valid NTSA vehicle inspection report", icon: "verify", color: "#f59e0b", expires: true, driverOnly: false },
  { type: "psv_badge", label: "PSV badge", hint: "Needed to carry customers for hire", icon: "idcard", color: "#8b5cf6", expires: true, driverOnly: true },
];

const STAGES = ["Details", "Documents", "Review", "Verified"];

async function fetchInfo(): Promise<Info | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("role,has_car,car_plate,car_details,car_status,car_rejection_reason")
    .eq("id", u.user.id)
    .maybeSingle();
  return {
    uid: u.user.id,
    role: p?.role ?? "customer",
    saved: { has: p?.has_car ?? null, plate: formatPlate(p?.car_plate), details: p?.car_details ?? "" },
    status: (p?.car_status ?? "unsubmitted") as Status,
    reason: p?.car_rejection_reason ?? null,
  };
}

async function fetchDocs(uid: string): Promise<Record<string, Doc | undefined>> {
  const { data } = await supabase
    .from("car_documents")
    .select("doc_type,file_path,expires_on,created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as { doc_type: string; file_path: string; expires_on: string | null }[];
  const latest = new Map<string, { path: string; expires: string | null }>();
  rows.forEach((r) => latest.set(r.doc_type, { path: r.file_path, expires: r.expires_on }));

  const paths = [...latest.values()].map((v) => v.path);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await supabase.storage.from("driver-docs").createSignedUrls(paths, 900);
    (signed.data ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    });
  }

  const out: Record<string, Doc | undefined> = {};
  latest.forEach((v, type) => {
    const days = v.expires ? Math.ceil((new Date(`${v.expires}T00:00:00`).getTime() - Date.now()) / 86400000) : null;
    out[type] = { path: v.path, url: urls.get(v.path) ?? "", expires: v.expires, days };
  });
  return out;
}

function Stages({ at, color }: { at: number; color: string }) {
  return (
    <div className="flex items-start">
      {STAGES.map((l, i) => (
        <div key={l} className="flex items-start flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className="relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: i <= at ? color : "#94a3b8" }}
            >
              {i === at && i < STAGES.length - 1 && (
                <span className="live-ping absolute inset-0 rounded-full" style={{ background: color, opacity: 0.4 }} />
              )}
              <span className="relative flex items-center justify-center">
                {i < at || (i === at && i === STAGES.length - 1) ? <Icon name="tick" className="w-4 h-4" /> : i + 1}
              </span>
            </span>
            <span className="text-[10px] font-bold" style={{ color: i <= at ? color : undefined }}>
              {l}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <span className="flex-1 h-0.5 mx-1 mt-3.5 rounded-full" style={{ background: i < at ? color : "#94a3b8", opacity: i < at ? 1 : 0.5 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function expiryPill(d: Doc) {
  if (d.days === null) return { text: "Added", color: "#059669" };
  if (d.days < 0) return { text: "Expired", color: "#dc2626" };
  if (d.days < MIN_DAYS) return { text: `Expires in ${d.days} day${d.days === 1 ? "" : "s"}`, color: "#dc2626" };
  if (d.days <= 30) return { text: `Expires in ${d.days} days`, color: "#d97706" };
  return { text: `Valid, ${d.days} days left`, color: "#059669" };
}

const FIELD =
  "w-full border-2 border-indigo-200 rounded-xl p-3 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export default function CarPage() {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [car, setCar] = useState<CarState>(emptyCar);
  const [docs, setDocs] = useState<Record<string, Doc | undefined>>({});
  const [staged, setStaged] = useState<Record<string, Staged | undefined>>({});
  const [minExpiry, setMinExpiry] = useState("");
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const stagedRef = useRef(staged);
  useEffect(() => {
    stagedRef.current = staged;
  });
  useEffect(
    () => () => {
      Object.values(stagedRef.current).forEach((s) => s?.url && URL.revokeObjectURL(s.url));
    },
    []
  );

  const load = async (first: boolean) => {
    const i = await fetchInfo();
    if (!i) return router.replace("/login");
    if (i.role === "admin") return router.replace("/profile");
    const d = await fetchDocs(i.uid);
    setInfo(i);
    setCar(i.saved);
    setDocs(d);
    setMinExpiry(isoDay(MIN_DAYS));
    if (first) setEditing(i.saved.has === null);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const i = await fetchInfo();
      if (!active) return;
      if (!i) return router.replace("/login");
      if (i.role === "admin") return router.replace("/profile");
      const d = await fetchDocs(i.uid);
      if (!active) return;
      setInfo(i);
      setCar(i.saved);
      setDocs(d);
      setMinExpiry(isoDay(MIN_DAYS));
      setEditing(i.saved.has === null);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const saveCar = async () => {
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
      return setMsg(friendlyError(friendlyDbError(error.message, error.code)));
    }
    await load(false);
    setBusy(false);
    setEditing(false);
    toast(car.has ? "Car saved. Now add your documents." : "Car updated", { tone: "ok" });
  };

  const stage = async (type: string, f: File) => {
    setMsg("");
    const ready = await compressImage(f);
    if (ready.size > 5 * 1024 * 1024) return setMsg("That file is too big. Use a photo or PDF under 5 MB.");
    const old = staged[type];
    if (old?.url) URL.revokeObjectURL(old.url);
    const url = ready.type.startsWith("image/") ? URL.createObjectURL(ready) : null;
    setStaged((p) => ({ ...p, [type]: { file: ready, url, expires: "" } }));
  };

  const unstage = (type: string) => {
    const old = staged[type];
    if (old?.url) URL.revokeObjectURL(old.url);
    setStaged((p) => ({ ...p, [type]: undefined }));
  };

  const saveDoc = async (type: string) => {
    const s = staged[type];
    const def = DOCS.find((d) => d.type === type);
    if (!s || !def || !info || uploading) return;
    setMsg("");
    if (def.expires) {
      if (!s.expires) return setMsg(`Enter the expiry date of the ${def.label.toLowerCase()}.`);
      if (s.expires < minExpiry) return setMsg(`The ${def.label.toLowerCase()} must be valid for at least a week more.`);
    }
    setUploading(type);
    const ext = s.file.type === "application/pdf" ? "pdf" : "jpg";
    const path = `${info.uid}/car-${type}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("driver-docs").upload(path, s.file);
    if (up.error) {
      setUploading(null);
      return setMsg(friendlyError(up.error.message));
    }
    const ins = await supabase.from("car_documents").insert({
      user_id: info.uid,
      doc_type: type,
      file_path: path,
      expires_on: def.expires ? s.expires : null,
    });
    if (ins.error) {
      setUploading(null);
      return setMsg(friendlyError(ins.error.message));
    }
    unstage(type);
    setDocs(await fetchDocs(info.uid));
    setUploading(null);
    toast("Document saved", { tone: "ok", ms: 2000 });
  };

  const submit = async () => {
    if (busy) return;
    setMsg("");
    setBusy(true);
    const { error } = await supabase.rpc("submit_car_for_review");
    if (error) {
      setBusy(false);
      return setMsg(friendlyError(error.message));
    }
    await load(false);
    setBusy(false);
    toast("Sent for review", { tone: "ok" });
  };

  if (!info) return <Loader full />;

  const isDriver = info.role === "driver";
  const needed = DOCS.filter((d) => isDriver || !d.driverOnly);
  const hasCar = info.saved.has === true;
  const savedCount = needed.filter((d) => docs[d.type]).length;
  const allValid = needed.every((d) => {
    const x = docs[d.type];
    return x && (!d.expires || (x.days !== null && x.days >= MIN_DAYS));
  });
  const locked = info.status === "pending" || info.status === "approved";
  const at = info.status === "approved" ? 3 : info.status === "pending" ? 2 : hasCar ? 1 : 0;
  const color = info.status === "approved" ? "#059669" : info.status === "rejected" || info.status === "expired" ? "#dc2626" : "#4338ca";
  const statusPill =
    info.status === "approved"
      ? { text: "Verified", color: "#059669" }
      : info.status === "pending"
        ? { text: "In review", color: "#d97706" }
        : info.status === "rejected"
          ? { text: "Rejected", color: "#dc2626" }
          : info.status === "expired"
            ? { text: "Expired", color: "#dc2626" }
            : { text: "Not verified", color: "#d97706" };

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader title="My vehicle" subtitle="Your car and its verification" href="/profile" back="Profile" />

        {editing ? (
          <section className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Tile name="car" color="#0ea5e9" />
              <div>
                <p className="font-bold">{info.saved.has === null ? "Tell us about your car" : "Change your car"}</p>
                <p className="text-xs text-gray-700">
                  {info.saved.has === null
                    ? "Add your car so people know which car to look for."
                    : "A new car needs to be verified again, and you cannot change it during a job."}
                </p>
              </div>
            </div>
            <CarFields value={car} onChange={setCar} />
            {msg && (
              <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                <Icon name="alert" className="w-4 h-4 mt-0.5" />
                {msg}
              </p>
            )}
            <div className="space-y-2">
              <button
                onClick={saveCar}
                disabled={busy}
                className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 shadow-lg disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {busy ? "Saving..." : "Save car"}
              </button>
              {info.saved.has !== null && (
                <button
                  onClick={() => {
                    setCar(info.saved);
                    setMsg("");
                    setEditing(false);
                  }}
                  className="w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3"
                >
                  Cancel
                </button>
              )}
            </div>
          </section>
        ) : !hasCar ? (
          <section className="bg-white rounded-2xl shadow p-6 text-center space-y-3">
            <div className="flex justify-center">
              <Tile name="user" color="#6366f1" size="w-14 h-14" />
            </div>
            <p className="font-bold">No vehicle on your account</p>
            <p className="text-sm text-gray-700">
              {isDriver
                ? "You can still take jobs where you drive the customer's car. Bought a car? Add it here to take jobs where you bring the car."
                : "Bought a car? Add it here to book a driver for it."}
            </p>
            <button onClick={() => setEditing(true)} className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 active:scale-[0.98]">
              I have a car now
            </button>
          </section>
        ) : (
          <>
            <section
              className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen space-y-4"
              style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Registered vehicle</p>
                  {info.saved.details && <p className="text-sm text-white/90 mt-1">{info.saved.details}</p>}
                </div>
                <Pill text={statusPill.text} color={statusPill.color} />
              </div>
              <div className="float">
                <PlateBadge plate={normalizePlate(info.saved.plate)} verified={info.status === "approved"} />
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow p-4 space-y-4">
              <Stages at={at} color={color} />
              <div className="rounded-xl bg-indigo-50 p-3 text-sm">
                <p className="font-bold">What verification unlocks</p>
                <p className="text-gray-800 mt-0.5">
                  {isDriver
                    ? "Jobs where you bring the car. Jobs where you drive the customer's car never need this."
                    : "Booking a driver for your own car."}
                </p>
              </div>

              {info.status === "approved" && (
                <p className="slide-in flex items-start gap-2 rounded-xl bg-green-50 text-green-800 text-sm font-semibold p-3">
                  <Icon name="check" className="w-4 h-4 mt-0.5" />
                  Your vehicle is verified. A green tick shows next to your plate.
                </p>
              )}
              {info.status === "pending" && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-800">We are checking your documents. You will be told when it is done.</p>
                  <div className="indeterminate h-1.5 rounded-full bg-indigo-100" />
                </div>
              )}
              {(info.status === "rejected" || info.status === "expired") && (
                <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                  <Icon name="alert" className="w-4 h-4 mt-0.5" />
                  <span>
                    {info.status === "expired" ? "A document has expired" : "Not accepted"}
                    {info.reason ? `: ${info.reason}` : "."} Upload the documents again and submit.
                  </span>
                </p>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Documents</h2>
                <span className="text-xs font-bold text-indigo-700">
                  {savedCount} of {needed.length} saved
                </span>
              </div>

              {needed.map((d, i) => {
                const doc = docs[d.type];
                const st = staged[d.type];
                const img = doc && /\.(jpe?g|png|webp|gif)$/i.test(doc.path);
                const pill = doc ? expiryPill(doc) : null;
                return (
                  <article
                    key={d.type}
                    className="slide-in bg-white rounded-2xl shadow overflow-hidden"
                    style={{ borderLeft: `4px solid ${doc ? pill?.color : d.color}`, animationDelay: `${i * 60}ms` }}
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Tile name={d.icon} color={d.color} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold leading-tight">{d.label}</p>
                          <p className="text-xs text-gray-700">{d.hint}</p>
                        </div>
                        {pill ? <Pill text={pill.text} color={pill.color} /> : <Pill text="Required" color="#d97706" />}
                      </div>

                      {st ? (
                        <div className="space-y-3">
                          <div className="relative rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100">
                            {st.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={st.url} alt={d.label} className="w-full max-h-48 object-cover" />
                            ) : (
                              <div className="flex items-center gap-3 p-4">
                                <Tile name="doc" color="#6366f1" />
                                <p className="text-sm font-semibold truncate">{st.file.name}</p>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => unstage(d.type)}
                              aria-label="Remove this file"
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90"
                            >
                              <Icon name="close" className="w-4 h-4" />
                            </button>
                          </div>

                          {d.expires && (
                            <div className="space-y-1">
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Expiry date shown on the document</p>
                              <input
                                type="date"
                                min={minExpiry}
                                className={FIELD}
                                value={st.expires}
                                onChange={(e) => setStaged((p) => ({ ...p, [d.type]: { ...st, expires: e.target.value } }))}
                              />
                            </div>
                          )}

                          <button
                            onClick={() => saveDoc(d.type)}
                            disabled={uploading !== null}
                            className="btn-shine grad-bg w-full text-white font-bold rounded-xl p-3 shadow disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            {uploading === d.type && (
                              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            )}
                            {uploading === d.type ? "Saving..." : "Save this document"}
                          </button>
                        </div>
                      ) : (
                        <>
                          {doc ? (
                            <div className="rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100">
                              {img && doc.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={doc.url} alt={d.label} className="w-full max-h-40 object-cover" />
                              ) : (
                                <div className="flex items-center gap-3 p-4">
                                  <Tile name="doc" color="#6366f1" />
                                  <p className="text-sm font-semibold">File saved</p>
                                </div>
                              )}
                              {doc.expires && (
                                <p className="px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
                                  <Icon name="calendar" className="w-3.5 h-3.5" />
                                  Expires on {new Date(`${doc.expires}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-xl border-2 border-dashed border-indigo-200 p-5 flex flex-col items-center gap-1 text-gray-700">
                              <span className="text-indigo-500">
                                <Icon name="upload" className="w-6 h-6" />
                              </span>
                              <span className="text-xs font-semibold">No file added yet</span>
                            </div>
                          )}
                          {!locked && <PhotoPicker allowPdf facing="environment" disabled={uploading !== null} onFile={(f) => stage(d.type, f)} />}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>

            {msg && (
              <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                <Icon name="alert" className="w-4 h-4 mt-0.5" />
                {msg}
              </p>
            )}

            {!locked && (
              <button
                onClick={submit}
                disabled={!allValid || busy || uploading !== null}
                className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <Icon name="send" className="w-5 h-5" />
                )}
                {busy ? "Sending..." : allValid ? "Submit for verification" : "Save every document first"}
              </button>
            )}

            <button
              onClick={() => {
                setMsg("");
                setEditing(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3.5 active:scale-[0.98]"
            >
              <Icon name="edit" className="w-4 h-4" />
              I got a new car or need to change details
            </button>
          </>
        )}
      </div>
      </main>
  );
}