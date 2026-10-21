"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type DocLink = { id: string; doc_type: string; url: string };
type PendingDriver = {
  id: string;
  full_name: string | null;
  phone: string | null;
  docs: DocLink[];
};

async function fetchAdminData(): Promise<{ allowed: boolean; pending: PendingDriver[] }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { allowed: false, pending: [] };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", u.user.id)
    .single();
  if (me?.role !== "admin") return { allowed: false, pending: [] };

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, profiles(full_name, phone)")
    .eq("verification_status", "pending");

  // Supabase returns profiles as an array of related rows
  const rows = (drivers ?? []) as {
    id: string;
    profiles: { full_name: string | null; phone: string | null }[]; 
  }[];

  if (rows.length === 0) return { allowed: true, pending: [] };

  const { data: docs } = await supabase
    .from("driver_documents")
    .select("id, driver_id, doc_type, file_path")
    .in("driver_id", rows.map((r) => r.id));

  const list = (docs ?? []) as {
    id: string;
    driver_id: string;
    doc_type: string;
    file_path: string;
  }[];

  const signed = await supabase.storage
    .from("driver-docs")
    .createSignedUrls(list.map((d) => d.file_path), 600);

  const urlByPath = new Map<string, string>(
    (signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl ?? ""])
  );

  return {
    allowed: true,
    pending: rows.map((r) => {
      const profile = r.profiles?.[0]; // safely pick the first profile
      return {
        id: r.id,
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        docs: list
          .filter((d) => d.driver_id === r.id)
          .map((d) => ({
            id: d.id,
            doc_type: d.doc_type,
            url: urlByPath.get(d.file_path) ?? "",
          })),
      };
    }),
  };
}


export default function AdminPage() {
  const [state, setState] = useState<{ allowed: boolean; pending: PendingDriver[] } | null>(null);

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
    const { error } = await supabase
      .from("drivers")
      .update({
        is_verified: approve,
        verification_status: approve ? "approved" : "rejected",
        rejection_reason: approve ? null : reason,
      })
      .eq("id", id);
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
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Driver verification</h1>
          <Link href="/dashboard" className="text-sm underline">Back to map</Link>
        </div>

        {state.pending.length === 0 && (
          <p className="text-gray-600">No drivers are waiting for review.</p>
        )}

        {state.pending.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl shadow p-4 space-y-3">
            <div>
              <p className="font-semibold">{d.full_name || "Unnamed driver"}</p>
              <p className="text-sm text-gray-500">{d.phone || "No phone"}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {d.docs.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline capitalize"
                >
                  {doc.doc_type.replace("_", " ")}
                </a>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decide(d.id, true)}
                className="flex-1 bg-green-600 text-white rounded-lg p-2"
              >
                Approve
              </button>
              <button
                onClick={() => decide(d.id, false)}
                className="flex-1 border rounded-lg p-2"
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
