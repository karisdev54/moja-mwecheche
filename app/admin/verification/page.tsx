"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import AdminTodo from "@/components/AdminTodo";
import { Empty, Icon, PageHeader, PersonRow, Pill, Stat } from "@/components/AdminUI";
import { alertDialog, confirmDialog, promptDialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { fetchAvatars } from "@/lib/avatars";

type Doc = { id: string; doc_type: string; path: string; url: string };
type Applicant = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  docs: Doc[];
  submitted: string | null;
  avatar: string | null;
};
type State = { allowed: boolean; pending: Applicant[]; at: number };

const DOC_LABEL: Record<string, { label: string; icon: string }> = {
  national_id: { label: "ID or passport", icon: "idcard" },
  driving_license: { label: "Driving licence", icon: "car" },
  good_conduct: { label: "Good conduct", icon: "verify" },
};

const CHECKS = [
  "The name on the documents matches the applicant",
  "Photos are clear and all corners are visible",
  "The ID and licence have not expired",
  "The licence class suits the work",
];

function ago(iso: string | null, now: number) {
  if (!iso) return "";
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

async function fetchData(): Promise<State> {
  const none: State = { allowed: false, pending: [], at: Date.now() };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return none;

  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "admin") return none;

  const { data: drivers } = await supabase.rpc("admin_pending_drivers");
  const rows = (drivers ?? []) as { id: string; full_name: string | null; phone: string | null; email: string | null }[];
  if (rows.length === 0) return { allowed: true, pending: [], at: Date.now() };
    const av = await fetchAvatars(rows.map((r) => r.id));
  const { data: docs } = await supabase
    .from("driver_documents")
    .select("id, driver_id, doc_type, file_path, created_at")
    .in("driver_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });
  const list = (docs ?? []) as { id: string; driver_id: string; doc_type: string; file_path: string; created_at: string }[];

  const urlByPath = new Map<string, string>();
  if (list.length > 0) {
    const signed = await supabase.storage.from("driver-docs").createSignedUrls(list.map((d) => d.file_path), 900);
    (signed.data ?? []).forEach((s) => {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    });
  }

  return {
    allowed: true,
    at: Date.now(),
    pending: rows.map((r) => {
      const mine = list.filter((d) => d.driver_id === r.id);
      // newest file of each type wins
      const latest = new Map<string, (typeof mine)[number]>();
      mine.forEach((d) => latest.set(d.doc_type, d));
      return {
        ...r,
        submitted: mine.length ? mine[mine.length - 1].created_at : null,
        avatar: av[r.id] ?? null,
        docs: [...latest.values()].map((d) => ({
          id: d.id,
          doc_type: d.doc_type,
          path: d.file_path,
          url: urlByPath.get(d.file_path) ?? "",
        })),
      };
    }),
  };
}

export default function VerificationPage() {
  const [state, setState] = useState<State | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchData().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const decide = async (a: Applicant, approve: boolean) => {
    let reason: string | null = null;

    if (!approve) {
      reason = await promptDialog({
        title: `Reject ${a.full_name || "this driver"}?`,
        message: "The driver will see this reason and can upload again.",
        placeholder: "For example: licence photo is blurry",
        multiline: true,
        required: true,
        minLength: 5,
        confirmText: "Reject",
        danger: true,
      });
      if (reason === null) return;
    } else {
      const ok = await confirmDialog({
        title: `Approve ${a.full_name || "this driver"}?`,
        message: "They will be able to go online and take jobs.",
        confirmText: "Approve",
      });
      if (!ok) return;
    }

    setBusyId(a.id);
    const { error } = await supabase
      .from("drivers")
      .update({
        is_verified: approve,
        verification_status: approve ? "approved" : "rejected",
        rejection_reason: approve ? null : reason,
      })
      .eq("id", a.id);
    setBusyId(null);

    if (error) {
      await alertDialog({ title: "Could not save", message: error.message });
      return;
    }
    toast(approve ? "Driver approved" : "Driver rejected", { tone: approve ? "ok" : "warn" });
    fetchData().then(setState);
  };

  if (!state) return <Loader full />;
  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const docTotal = state.pending.reduce((s, a) => s + a.docs.length, 0);

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Verify drivers" subtitle="Review documents before drivers go online" />
        <AdminNav />
        <AdminTodo kind="verify" />

        <div className="grid grid-cols-2 gap-3">
          <Stat icon="verify" color="#d97706" label="Waiting for review" value={state.pending.length} />
          <Stat icon="doc" color="#6366f1" label="Documents to check" value={docTotal} />
        </div>

        {state.pending.length === 0 && (
          <Empty icon="check" title="All caught up" text="No drivers are waiting for review right now." />
        )}

        {state.pending.map((a, i) => (
          <article
            key={a.id}
            className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <div className="w-1.5 shrink-0" style={{ background: "#d97706" }} />
            <div className="flex-1 min-w-0 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg leading-tight">{a.full_name || "Unnamed driver"}</h3>
                  <p className="text-xs text-gray-700 mt-1">
                    {a.submitted ? `Submitted ${ago(a.submitted, state.at)}` : "No documents yet"}
                  </p>
                </div>
                <Pill text="Pending review" color="#d97706" />
              </div>

              <PersonRow role="Applicant" name={a.full_name} phone={a.phone} avatar={a.avatar}>
                <p className="text-xs text-gray-700 truncate">{a.email || "No email"}</p>
              </PersonRow>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Documents, tap to open full size
                </p>
                {a.docs.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                    <Icon name="alert" className="w-4 h-4" />
                    No documents uploaded
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {a.docs.map((doc) => {
                      const meta = DOC_LABEL[doc.doc_type] ?? { label: doc.doc_type.replace(/_/g, " "), icon: "doc" };
                      const img = /\.(jpe?g|png|webp|gif)$/i.test(doc.path);
                      const inner = (
                        <>
                          {img && doc.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={doc.url} alt={meta.label} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <span className="text-indigo-600">
                              <Icon name={doc.url ? meta.icon : "alert"} className="w-8 h-8" />
                            </span>
                          )}
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[11px] font-bold px-2 py-1.5 flex items-center gap-1.5">
                            <Icon name={meta.icon} className="w-3.5 h-3.5" />
                            {doc.url ? meta.label : "Link unavailable"}
                          </span>
                        </>
                      );
                      const cls =
                        "relative aspect-[4/3] rounded-xl overflow-hidden bg-indigo-50 border border-indigo-100 flex items-center justify-center active:scale-95";
                      return doc.url ? (
                        <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className={cls}>
                          {inner}
                        </a>
                      ) : (
                        <div key={doc.id} className={cls}>
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-indigo-50 p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Before you approve</p>
                {CHECKS.map((c) => (
                  <p key={c} className="flex items-start gap-2 text-xs text-gray-800">
                    <span className="text-indigo-600 mt-0.5">
                      <Icon name="tick" className="w-3.5 h-3.5" />
                    </span>
                    {c}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => decide(a, true)}
                  disabled={busyId === a.id}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl p-3.5 disabled:opacity-50 active:scale-95"
                >
                  <Icon name="check" className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => decide(a, false)}
                  disabled={busyId === a.id}
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