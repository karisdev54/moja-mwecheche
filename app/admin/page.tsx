"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type DocLink = { id: string; doc_type: string; url: string };
type PendingDriver = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  docs: DocLink[];
};
type State = { allowed: boolean; pending: PendingDriver[] };

async function fetchAdminData(): Promise<State> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { allowed: false, pending: [] };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", u.user.id)
    .maybeSingle();
  if (me?.role !== "admin") return { allowed: false, pending: [] };

  const { data: drivers } = await supabase.rpc("admin_pending_drivers");
  const rows = (drivers ?? []) as {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
  }[];
  if (rows.length === 0) return { allowed: true, pending: [] };

  const { data: docs } = await supabase
    .from("driver_documents")
    .select("id, driver_id, doc_type, file_path")
    .in("driver_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });
  const list = (docs ?? []) as {
    id: string;
    driver_id: string;
    doc_type: string;
    file_path: string;
  }[];

  const urlByPath = new Map<string, string>();
  if (list.length > 0) {
    const signed = await supabase.storage
      .from("driver-docs")
      .createSignedUrls(list.map((d) => d.file_path), 600);
    (signed.data ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    });
  }

  return {
    allowed: true,
    pending: rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      email: r.email,
      docs: list
        .filter((d) => d.driver_id === r.id)
        .map((d) => ({
          id: d.id,
          doc_type: d.doc_type,
          url: urlByPath.get(d.file_path) ?? "",
        })),
    })),
  };
}

export default function AdminPage() {
  const [state, setState] = useState<State | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdminData().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const decide = async (id: string, approve: boolean) => {
    let reason: string | null = null;
    if (!approve) {
      reason = window.prompt("Reason for rejection (the driver will see this):");
      if (reason === null) return;
    }
    setBusyId(id);
    const { error } = await supabase
      .from("drivers")
      .update({
        is_verified: approve,
        verification_status: approve ? "approved" : "rejected",
        rejection_reason: approve ? null : reason,
      })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      alert(error.message);
      return;
    }
    fetchAdminData().then(setState);
  };

  if (!state) return <p className="p-6">Loading...</p>;

  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized.{" "}
        <Link href="/login" className="underline">
          Log in as admin
        </Link>
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4 text-gray-900">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Driver verification</h1>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/admin/stats" className="underline font-semibold">Overview</Link>
            <Link href="/admin/payouts" className="underline font-semibold">Payouts</Link>
            <Link href="/admin/refunds" className="underline font-semibold">Refunds</Link>
            <Link href="/dashboard" className="underline">Back to map</Link>
          </div>
        </div>

        {state.pending.length === 0 && (
          <p className="text-gray-700">No drivers are waiting for review.</p>
        )}

        {state.pending.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl shadow p-4 space-y-3">
            <div>
              <p className="font-semibold text-lg">{d.full_name || "Unnamed driver"}</p>
              <p className="text-sm text-gray-800">📞 {d.phone || "No phone saved"}</p>
              <p className="text-sm text-gray-800">✉️ {d.email || "No email"}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              {d.docs.length === 0 && (
                <span className="text-red-600">No documents uploaded</span>
              )}
              {d.docs.map((doc) =>
                doc.url ? (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline font-semibold capitalize"
                  >
                    {doc.doc_type.replace(/_/g, " ")}
                  </a>
                ) : (
                  <span key={doc.id} className="text-gray-700 capitalize">
                    {doc.doc_type.replace(/_/g, " ")} (link unavailable)
                  </span>
                )
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => decide(d.id, true)}
                disabled={busyId === d.id}
                className="flex-1 bg-green-600 text-white font-bold rounded-lg p-3 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide(d.id, false)}
                disabled={busyId === d.id}
                className="flex-1 bg-white border-2 border-red-300 text-red-700 font-bold rounded-lg p-3 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
