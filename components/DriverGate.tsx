"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import DriverToggle from "@/components/DriverToggle";
import DriverJobs from "@/components/DriverJobs";

type DriverRow = {
  is_verified: boolean;
  verification_status: "unsubmitted" | "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

const DOCS = [
  { type: "national_id", label: "National ID or passport", required: true },
  { type: "driving_license", label: "Driving license", required: true },
  { type: "good_conduct", label: "Certificate of good conduct (optional)", required: false },
];

async function fetchDriver(driverId: string): Promise<DriverRow | null> {
  const { data } = await supabase
    .from("drivers")
    .select("is_verified,verification_status,rejection_reason")
    .eq("id", driverId)
    .single();
  return data as DriverRow | null;
}

export default function DriverGate({ driverId }: { driverId: string }) {
  const [info, setInfo] = useState<DriverRow | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let active = true;

    fetchDriver(driverId).then((d) => {
      if (active) setInfo(d);
    });

    const channel = supabase
      .channel("my-driver-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers", filter: `id=eq.${driverId}` },
        (payload: { new: Partial<DriverRow> }) => {
          const n = payload.new;
          if (active && n.verification_status) {
            setInfo({
              is_verified: !!n.is_verified,
              verification_status: n.verification_status,
              rejection_reason: n.rejection_reason ?? null,
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  const submit = async () => {
    setMsg("");
    if (DOCS.some((d) => d.required && !files[d.type])) {
      setMsg("Please attach your ID and driving license.");
      return;
    }
    if (Object.values(files).some((f) => f && f.size > 5 * 1024 * 1024)) {
      setMsg("Each file must be under 5 MB.");
      return;
    }

    setBusy(true);
    for (const d of DOCS) {
      const f = files[d.type];
      if (!f) continue;
      const ext = f.name.split(".").pop() || "jpg";
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

    const { error } = await supabase
      .from("drivers")
      .update({ verification_status: "pending" })
      .eq("id", driverId);
    setBusy(false);
    if (error) setMsg(error.message);
    else fetchDriver(driverId).then(setInfo);
  };

  if (!info) {
    return (
      <div className=" left-4 right-4 max-w-md mx-auto bg-white rounded-2xl shadow p-4 text-sm">
        Loading...
      </div>
    );
  }

  if (info.is_verified) {
  return (
    <div className="flex flex-col gap-3">
      <DriverJobs driverId={driverId} />
      <div className="flex justify-center">
        <DriverToggle driverId={driverId} />
      </div>
    </div>
  );
}

  return (
  <div className="bg-white rounded-2xl shadow p-4 text-sm text-gray-900">
    Loading...
  
      {info.verification_status === "pending" ? (
        <>
          <p className="font-semibold">Documents under review</p>
          <p className="text-sm text-gray-600">
            We are checking your documents. You will be able to go online as soon as you are approved.
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold">Verify your account</p>
          {info.verification_status === "rejected" && (
            <p className="text-sm text-red-600">
              Your last submission was rejected
              {info.rejection_reason ? `: ${info.rejection_reason}` : "."} Please upload again.
            </p>
          )}
          <p className="text-sm text-gray-600">
            Upload clear photos or PDFs. You can start driving once an admin approves them.
          </p>
          {DOCS.map((d) => (
            <label key={d.type} className="block text-sm">
              <span className="block mb-1">{d.label}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="w-full text-sm"
                onChange={(e) =>
                  setFiles((prev) => ({ ...prev, [d.type]: e.target.files?.[0] ?? null }))
                }
              />
            </label>
          ))}
          {msg && <p className="text-red-600 text-sm">{msg}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="w-full bg-black text-white rounded-lg p-3 disabled:opacity-50"
          >
            {busy ? "Uploading..." : "Submit for review"}
          </button>
        </>
      )}
    </div>
  );
}