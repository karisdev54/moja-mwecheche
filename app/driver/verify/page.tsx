"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image";

const DOCS = [
  { type: "national_id", label: "National ID or passport", hint: "Photo page, all four corners visible", required: true, icon: "🪪" },
  { type: "driving_license", label: "Driving licence", hint: "Front side, clear and readable", required: true, icon: "🚗" },
  { type: "good_conduct", label: "Certificate of good conduct", hint: "Optional, but builds customer trust", required: false, icon: "📄" },
];

type Picked = { file: File; url: string | null };

export default function VerifyPage() {
  const router = useRouter();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<Record<string, Picked | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [msg, setMsg] = useState("");

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
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const choose = async (type: string, f: File | undefined) => {
    if (!f) return;
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

  const requiredDone = DOCS.filter((d) => d.required).every((d) => picked[d.type]);
  const doneCount = DOCS.filter((d) => d.required && picked[d.type]).length;

  const submit = async () => {
    if (!driverId || !requiredDone) return;
    setMsg("");
    setBusy(true);

    const chosen = DOCS.filter((d) => picked[d.type]);
    for (let i = 0; i < chosen.length; i++) {
      const d = chosen[i];
      const f = picked[d.type]!.file;
      setStep(`Uploading ${i + 1} of ${chosen.length}...`);
      const ext = f.type === "application/pdf" ? "pdf" : "jpg";
      const path = `${driverId}/${d.type}-${Date.now()}.${ext}`;

      const up = await supabase.storage.from("driver-docs").upload(path, f);
      if (up.error) {
        setMsg(up.error.message);
        setBusy(false);
        return;
      }
      const ins = await supabase
        .from("driver_documents")
        .insert({ driver_id: driverId, doc_type: d.type, file_path: path });
      if (ins.error) {
        setMsg(ins.error.message);
        setBusy(false);
        return;
      }
    }

    setStep("Sending for review...");
    const { error } = await supabase
      .from("drivers")
      .update({ verification_status: "pending" })
      .eq("id", driverId);
    if (error) {
      setMsg(error.message);
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
  };

  if (!loaded) return <p className="p-6">Loading...</p>;

  if (status === "pending") {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 space-y-3 text-gray-900">
          <p className="text-xl font-bold">⏳ Documents under review</p>
          <p>We are checking your documents and will approve you as soon as possible.</p>
          <Link href="/dashboard" className="block bg-indigo-600 text-white rounded-xl p-3 text-center font-bold">Back to map</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-32">
      <div className="max-w-md mx-auto space-y-4 text-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Verify your account</h1>
          <Link href="/dashboard" className="text-sm underline">Back</Link>
        </div>

        {status === "rejected" && (
          <p className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-700">
            Your last submission was rejected{reason ? `: ${reason}` : "."} Please upload clear photos again.
          </p>
        )}

        <div>
          <div className="flex justify-between text-sm font-semibold mb-1">
            <span>Required documents</span>
            <span>{doneCount} of 2</span>
          </div>
          <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
            <div className="h-3 bg-indigo-600 rounded-full" style={{ width: `${(doneCount / 2) * 100}%` }} />
          </div>
        </div>

        {DOCS.map((d) => {
          const p = picked[d.type];
          return (
            <label
              key={d.type}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 cursor-pointer bg-white ${
                p ? "border-green-500" : "border-dashed border-indigo-300"
              }`}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={busy}
                onChange={(e) => choose(d.type, e.target.files?.[0])}
              />
              <div className="w-20 h-20 rounded-xl bg-indigo-50 flex items-center justify-center overflow-hidden shrink-0 text-3xl">
                {p?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={d.label} className="w-full h-full object-cover" />
                ) : (
                  d.icon
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold">
                  {d.label} {!d.required && <span className="text-xs font-normal">(optional)</span>}
                </p>
                <p className="text-xs text-gray-700">{d.hint}</p>
                <p className={`text-sm font-semibold mt-1 ${p ? "text-green-700" : "text-indigo-700"}`}>
                  {p ? "✓ Added. Tap to change" : "Tap to take a photo or choose a file"}
                </p>
              </div>
            </label>
          );
        })}

        {msg && <p className="text-red-600 text-sm">{msg}</p>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-indigo-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          <button
            onClick={submit}
            disabled={!requiredDone || busy}
            className="w-full bg-indigo-600 text-white font-bold rounded-xl p-4 disabled:opacity-50"
          >
            {busy ? step : requiredDone ? "Submit for review" : "Add your ID and licence to continue"}
          </button>
        </div>
      </div>
    </main>
  );
}