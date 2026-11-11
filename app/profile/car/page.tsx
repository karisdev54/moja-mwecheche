"use client";
import { useEffect, useState } from "react";
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

type Status = "unsubmitted" | "pending" | "approved" | "rejected";
type Doc = { path: string; url: string };
type Info = { role: string; saved: CarState; status: Status; reason: string | null };

const DOCS = [
  { type: "logbook", label: "Logbook or registration", hint: "The page showing the plate number and the owner's name", required: true, icon: "doc", color: "#6366f1" },
  { type: "car_photo", label: "Photo of the car", hint: "The whole car, with the number plate clearly visible", required: true, icon: "car", color: "#0ea5e9" },
  { type: "insurance", label: "Insurance sticker or certificate", hint: "Optional, but builds trust", required: false, icon: "shield", color: "#10b981" },
];

const STAGES = ["Details", "Documents", "Review", "Verified"];

async function fetchInfo(): Promise<(Info & { uid: string }) | null> {
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
    .select("doc_type,file_path,created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as { doc_type: string; file_path: string }[];
  const latest = new Map<string, string>();
  rows.forEach((r) => latest.set(r.doc_type, r.file_path));
  const paths = [...latest.values()];
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await supabase.storage.from("driver-docs").createSignedUrls(paths, 900);
    (signed.data ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    });
  }
  const out: Record<string, Doc | undefined> = {};
  latest.forEach((path, type) => {
    out[type] = { path, url: urls.get(path) ?? "" };
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

export default function CarPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [car, setCar] = useState<CarState>(emptyCar);
  const [docs, setDocs] = useState<Record<string, Doc | undefined>>({});
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const reload = async () => {
    const i = await fetchInfo();
    if (!i) return router.replace("/login");
    if (i.role === "admin") return router.replace("/profile");
    setUid(i.uid);
    setInfo(i);
    setCar(i.saved);
    setDocs(await fetchDocs(i.uid));
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
      setUid(i.uid);
      setInfo(i);
      setCar(i.saved);
      setDocs(d);
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
    await reload();
    setBusy(false);
    setEditing(false);
    toast(car.has ? "Car saved. Now add your documents." : "Car updated", { tone: "ok" });
  };

  const upload = async (type: string, f: File) => {
    if (!uid || uploading) return;
    setMsg("");
    const ready = await compressImage(f);
    if (ready.size > 5 * 1024 * 1024) return setMsg("That file is too big. Use a photo or PDF under 5 MB.");
    setUploading(type);
    const ext = ready.type === "application/pdf" ? "pdf" : "jpg";
    const path = `${uid}/car-${type}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("driver-docs").upload(path, ready);
    if (up.error) {
      setUploading(null);
      return setMsg(friendlyError(up.error.message));
    }
    const ins = await supabase.from("car_documents").insert({ user_id: uid, doc_type: type, file_path: path });
    if (ins.error) {
      setUploading(null);
      return setMsg(friendlyError(ins.error.message));
    }
    setDocs(await fetchDocs(uid));
    setUploading(null);
    toast("Document added", { tone: "ok", ms: 2000 });
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
    await reload();
    setBusy(false);
    toast("Sent for review", { tone: "ok" });
  };

  if (!info) return <Loader full />;

  const hasCar = info.saved.has === true;
  const required = DOCS.filter((d) => d.required);
  const haveRequired = required.every((d) => docs[d.type]);
  const locked = info.status === "pending" || info.status === "approved";
  const stage =
    info.status === "approved" ? 3 : info.status === "pending" ? 2 : hasCar ? 1 : 0;
  const color = info.status === "approved" ? "#059669" : info.status === "rejected" ? "#dc2626" : "#4338ca";

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader title="My vehicle" subtitle="Your car and its verification" href="/profile"/>

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
            <p className="text-sm text-gray-700">Bought a car? Add it here to book a driver for it, or to drive with it.</p>
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
                <Pill
                  text={
                    info.status === "approved" ? "Verified" : info.status === "pending" ? "In review" : info.status === "rejected" ? "Rejected" : "Not verified"
                  }
                  color={info.status === "approved" ? "#059669" : info.status === "rejected" ? "#dc2626" : "#d97706"}
                />
              </div>
              <div className="float">
                <PlateBadge plate={normalizePlate(info.saved.plate)} verified={info.status === "approved"} />
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow p-4 space-y-4">
              <Stages at={stage} color={color} />

              {info.status === "approved" && (
                <p className="slide-in flex items-start gap-2 rounded-xl bg-green-50 text-green-800 text-sm font-semibold p-3">
                  <Icon name="check" className="w-4 h-4 mt-0.5" />
                  Your vehicle is verified. A green tick shows next to your plate for customers.
                </p>
              )}
              {info.status === "pending" && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-800">We are checking your documents. You will be told when it is done.</p>
                  <div className="indeterminate h-1.5 rounded-full bg-indigo-100" />
                </div>
              )}
              {info.status === "rejected" && (
                <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                  <Icon name="alert" className="w-4 h-4 mt-0.5" />
                  <span>Not accepted{info.reason ? `: ${info.reason}` : "."} Upload clearer documents and submit again.</span>
                </p>
              )}
            </section>

            {info.status !== "approved" && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Documents</h2>
                {DOCS.map((d, i) => {
                  const doc = docs[d.type];
                  const img = doc && /\.(jpe?g|png|webp|gif)$/i.test(doc.path);
                  return (
                    <article
                      key={d.type}
                      className="slide-in bg-white rounded-2xl shadow overflow-hidden"
                      style={{ borderLeft: `4px solid ${doc ? "#059669" : d.color}`, animationDelay: `${i * 60}ms` }}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <Tile name={d.icon} color={d.color} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold leading-tight">{d.label}</p>
                            <p className="text-xs text-gray-700">{d.hint}</p>
                          </div>
                          <Pill text={doc ? "Added" : d.required ? "Required" : "Optional"} color={doc ? "#059669" : d.required ? "#d97706" : "#64748b"} />
                        </div>

                        {doc ? (
                          <div className="rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100">
                            {img && doc.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={doc.url} alt={d.label} className="w-full max-h-48 object-cover" />
                            ) : (
                              <div className="flex items-center gap-3 p-4">
                                <Tile name="doc" color="#6366f1" />
                                <p className="text-sm font-semibold">File added</p>
                              </div>
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

                        {uploading === d.type ? (
                          <div className="space-y-1">
                            <div className="indeterminate h-1.5 rounded-full bg-indigo-100" />
                            <p className="text-xs font-semibold">Uploading...</p>
                          </div>
                        ) : (
                          !locked && <PhotoPicker allowPdf facing="environment" disabled={uploading !== null} onFile={(f) => upload(d.type, f)} />
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

            {msg && (
              <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                <Icon name="alert" className="w-4 h-4 mt-0.5" />
                {msg}
              </p>
            )}

            {!locked && (
              <button
                onClick={submit}
                disabled={!haveRequired || busy || uploading !== null}
                className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <Icon name="send" className="w-5 h-5" />
                )}
                {busy ? "Sending..." : haveRequired ? "Submit for verification" : "Add the logbook and the car photo first"}
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