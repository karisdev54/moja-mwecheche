"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";
import PhotoPicker from "@/components/PhotoPicker";
import Loader from "@/components/Loader";
import { Icon, PageHeader, Pill, Tile } from "@/components/AdminUI";
import { toast } from "@/lib/toast";

const DOCS = [
  { type: "national_id", label: "National ID or passport", hint: "Photo page, all four corners visible", required: true, icon: "idcard", color: "#6366f1" },
  { type: "driving_license", label: "Driving licence", hint: "Front side, clear and readable", required: true, icon: "car", color: "#0ea5e9" },
  { type: "good_conduct", label: "Certificate of good conduct", hint: "Optional, but builds customer trust", required: false, icon: "verify", color: "#10b981" },
];

const TIPS = ["Use good light and avoid glare", "Show all four corners of the document", "Make sure the text is readable", "Use your own documents only"];

type Picked = { file: File; url: string | null };
type Phase = "loading" | "form" | "pending" | "done";

export default function VerifyPage() {
  const router = useRouter();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [picked, setPicked] = useState<Record<string, Picked | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState("");

  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  });
  useEffect(
    () => () => {
      Object.values(pickedRef.current).forEach((p) => p?.url && URL.revokeObjectURL(p.url));
    },
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("drivers")
        .select("is_verified,verification_status,rejection_reason")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!active) return;
      if (!data || data.is_verified) {
        router.replace("/dashboard");
        return;
      }
      setDriverId(u.user.id);
      setStatus(data.verification_status);
      setReason(data.rejection_reason);
      setPhase(data.verification_status === "pending" ? "pending" : "form");
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const choose = async (type: string, f: File) => {
    setMsg("");
    const ready = await compressImage(f);
    if (ready.size > 5 * 1024 * 1024) {
      setMsg("That file is too big. Please use a photo or a PDF under 5 MB.");
      return;
    }
    const old = picked[type];
    if (old?.url) URL.revokeObjectURL(old.url);
    const url = ready.type.startsWith("image/") ? URL.createObjectURL(ready) : null;
    setPicked((prev) => ({ ...prev, [type]: { file: ready, url } }));
  };

  const remove = (type: string) => {
    const old = picked[type];
    if (old?.url) URL.revokeObjectURL(old.url);
    setPicked((prev) => ({ ...prev, [type]: undefined }));
  };

  const required = DOCS.filter((d) => d.required);
  const doneCount = required.filter((d) => picked[d.type]).length;
  const requiredDone = doneCount === required.length;

  const submit = async () => {
    if (!driverId || !requiredDone || busy) return;
    setMsg("");
    setBusy(true);
    setProg(0);

    const chosen = DOCS.filter((d) => picked[d.type]);
    const total = chosen.length + 1;

    for (let i = 0; i < chosen.length; i++) {
      const d = chosen[i];
      const f = picked[d.type]!.file;
      setStep(`Uploading ${i + 1} of ${chosen.length}`);
      setProg(i / total);
      const ext = f.type === "application/pdf" ? "pdf" : "jpg";
      const path = `${driverId}/${d.type}-${Date.now()}.${ext}`;

      const up = await supabase.storage.from("driver-docs").upload(path, f);
      if (up.error) {
        setMsg(up.error.message);
        toast("Upload failed. Please try again.", { tone: "danger" });
        setBusy(false);
        setProg(0);
        return;
      }
      const ins = await supabase.from("driver_documents").insert({ driver_id: driverId, doc_type: d.type, file_path: path });
      if (ins.error) {
        setMsg(ins.error.message);
        setBusy(false);
        setProg(0);
        return;
      }
    }

    setStep("Sending for review");
    setProg(chosen.length / total);
    const { error } = await supabase.from("drivers").update({ verification_status: "pending" }).eq("id", driverId);
    if (error) {
      setMsg(error.message);
      setBusy(false);
      setProg(0);
      return;
    }
    setProg(1);
    setBusy(false);
    setPhase("done");
    setTimeout(() => router.replace("/dashboard"), 2600);
  };

  if (phase === "loading") return <Loader full />;

  if (phase === "done") {
    return (
      <main className="min-h-dvh flex items-center justify-center p-5" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center space-y-3 text-gray-900 pop-in">
          <div className="relative mx-auto w-20 h-20">
            <span className="pulse-ring absolute inset-0 rounded-full bg-green-400/50" />
            <svg viewBox="0 0 52 52" className="relative w-20 h-20">
              <circle className="check-circle" cx="26" cy="26" r="25" fill="none" stroke="#16a34a" strokeWidth="3" />
              <path className="check-tick" d="M14 27l8 8 16-16" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold">Submitted for review</h1>
          <p className="text-sm text-gray-700">We will check your documents and update your dashboard as soon as you are approved.</p>
          <p className="text-xs text-gray-700">Taking you back to the map...</p>
        </div>
      </main>
    );
  }

  if (phase === "pending") {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
          <PageHeader title="Verification" subtitle="Your documents are being checked" href="/dashboard" />
          <section
            className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl sheen space-y-4"
            style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
          >
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center float">
              <Icon name="clock" className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Under review</h2>
              <p className="text-sm text-white/85 mt-1">
                We are checking your documents. You can go online as soon as you are approved, and this will update by itself.
              </p>
            </div>
            <div className="indeterminate h-1.5 rounded-full bg-white/25" />
          </section>
          <Link href="/dashboard" className="btn-shine grad-bg block text-center text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98]">
            Back to the map
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-40">
      <div className="max-w-md mx-auto space-y-5 text-gray-900">
        <PageHeader title="Verify your account" subtitle="Upload your documents to start driving" href="/dashboard" />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Required documents</p>
              <p className="text-4xl font-extrabold tracking-tight mt-1">
                {doneCount} <span className="text-xl font-bold text-white/80">of {required.length}</span>
              </p>
            </div>
            <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Icon name={requiredDone ? "check" : "upload"} className="w-6 h-6" />
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/25 mt-4 overflow-hidden">
            <div
              className="h-2 rounded-full bg-white transition-[width] duration-500 ease-out"
              style={{ width: `${(doneCount / required.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-white/85 mt-2">
            {requiredDone ? "Ready to submit. Add the optional certificate if you have one." : "Add your ID and driving licence to continue."}
          </p>
        </section>

        {status === "rejected" && (
          <div
            className="slide-in flex items-start gap-3 rounded-2xl bg-white shadow p-4"
            style={{ borderLeft: "4px solid #dc2626" }}
          >
            <Tile name="alert" color="#dc2626" />
            <div>
              <p className="font-bold">Your last submission was not accepted</p>
              <p className="text-sm text-gray-700">{reason || "Please upload clear photos again."}</p>
            </div>
          </div>
        )}

        <section className="bg-white rounded-2xl shadow p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Tips for a quick approval</p>
          <ul className="grid gap-1.5">
            {TIPS.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                  <Icon name="tick" className="w-3 h-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {DOCS.map((d, i) => {
          const p = picked[d.type];
          return (
            <section
              key={d.type}
              className="slide-in bg-white rounded-2xl shadow overflow-hidden"
              style={{ borderLeft: `4px solid ${p ? "#059669" : d.color}`, animationDelay: `${i * 70}ms` }}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Tile name={d.icon} color={d.color} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight">{d.label}</p>
                    <p className="text-xs text-gray-700">{d.hint}</p>
                  </div>
                  <Pill
                    text={p ? "Added" : d.required ? "Required" : "Optional"}
                    color={p ? "#059669" : d.required ? "#d97706" : "#64748b"}
                  />
                </div>

                {p ? (
                  <div className="relative rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100">
                    {p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={d.label} className="w-full max-h-56 object-cover" />
                    ) : (
                      <div className="flex items-center gap-3 p-4">
                        <Tile name="doc" color="#6366f1" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{p.file.name}</p>
                          <p className="text-xs text-gray-700">PDF, {Math.round(p.file.size / 1024)} KB</p>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(d.type)}
                      disabled={busy}
                      aria-label={`Remove ${d.label}`}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 disabled:opacity-50"
                    >
                      <Icon name="close" className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-indigo-200 p-5 flex flex-col items-center gap-1 text-gray-700">
                    <span className="text-indigo-500">
                      <Icon name="upload" className="w-6 h-6" />
                    </span>
                    <span className="text-xs font-semibold">No file added yet</span>
                  </div>
                )}

                <PhotoPicker allowPdf facing="environment" disabled={busy} onFile={(f) => choose(d.type, f)} />
              </div>
            </section>
          );
        })}

        {msg && (
          <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
            <Icon name="alert" className="w-4 h-4 mt-0.5" />
            {msg}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 glass border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto space-y-2">
          {busy && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                <div className="h-1.5 rounded-full grad-bg transition-[width] duration-500" style={{ width: `${Math.round(prog * 100)}%` }} />
              </div>
              <p className="text-xs font-semibold text-gray-800">{step}</p>
            </div>
          )}
          <button
            onClick={submit}
            disabled={!requiredDone || busy}
            className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Icon name="send" className="w-5 h-5" />
            )}
            {busy ? "Please wait" : requiredDone ? "Submit for review" : "Add your ID and licence to continue"}
          </button>
        </div>
      </div>
    </main>
  );
}