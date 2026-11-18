"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import { Icon, Pill } from "@/components/AdminUI";
import { alertDialog, promptDialog } from "@/lib/dialog";
import { friendlyError } from "@/lib/net";
import { toast } from "@/lib/toast";

type Req = {
  id: string;
  driver_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  amount: number;
  note: string | null;
  requested_at: string;
};

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const today = () => new Date().toISOString().slice(0, 10);
const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PayoutQueue({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("admin_payout_queue");
    const list = ((data ?? []) as Req[]).map((r) => ({ ...r, amount: Number(r.amount) }));
    setRows(list);
    setSel((s) => s.filter((id) => list.some((r) => r.id === id)));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.rpc("admin_payout_queue").then(({ data }) => {
      if (!active) return;
      const list = ((data ?? []) as Req[]).map((r) => ({ ...r, amount: Number(r.amount) }));
      setRows(list);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!rows) return null;

  const chosen = rows.filter((r) => sel.includes(r.id));
  const target = chosen.length > 0 ? chosen : rows;
  const total = target.reduce((s, r) => s + r.amount, 0);
  const allOn = rows.length > 0 && sel.length === rows.length;

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const exportCsv = () => {
    const lines = ["Phone,Amount,Name,Reference"];
    target.forEach((r) => {
      const phone = (r.phone ?? "").replace(/\D/g, "");
      lines.push([phone, String(Math.round(r.amount)), cell(r.full_name ?? ""), "KEYANDGO PAYOUT"].join(","));
    });
    download(`payouts-${today()}.csv`, lines.join("\n"));
    toast("File downloaded. Match its columns to your M-Pesa bulk payment template.", { tone: "ok", ms: 5000 });
  };

  const pay = async (list: Req[]) => {
    if (list.length === 0 || busy) return;
    const ref = await promptDialog({
      title: list.length === 1 ? `Record the payment to ${list[0].full_name || "the driver"}` : `Record ${list.length} payments`,
      message:
        list.length === 1
          ? `${kes(list[0].amount)} to ${list[0].phone}. Enter the M-Pesa confirmation code.`
          : `${kes(list.reduce((s, r) => s + r.amount, 0))} in total. Enter the M-Pesa batch or confirmation code.`,
      placeholder: "M-Pesa code",
      required: true,
      minLength: 5,
      maxLength: 40,
      confirmText: "Record as paid",
    });
    if (ref === null) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_pay_requests", { p_ids: list.map((r) => r.id), p_reference: ref });
    setBusy(false);
    if (error) {
      await alertDialog({ title: "Could not record", message: friendlyError(error.message) });
      load();
      return;
    }
    toast(`${data} payout${data === 1 ? "" : "s"} recorded`, { tone: "ok" });
    setSel([]);
    await load();
    onChanged();
  };

  const reject = async (r: Req) => {
    const reason = await promptDialog({
      title: `Do not pay ${r.full_name || "this driver"}?`,
      message: "The driver will see this reason, and the money stays in their balance.",
      placeholder: "For example: phone number is wrong",
      multiline: true,
      required: true,
      minLength: 3,
      confirmText: "Reject request",
      danger: true,
    });
    if (reason === null) return;
    const { error } = await supabase.rpc("admin_reject_payout_request", { p_id: r.id, p_note: reason });
    if (error) {
      await alertDialog({ title: "Could not reject", message: friendlyError(error.message) });
      return;
    }
    toast("Request rejected", { tone: "warn" });
    await load();
    onChanged();
  };

  const weekly = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_weekly_requests");
    setBusy(false);
    if (error) {
      await alertDialog({ title: "Could not create requests", message: friendlyError(error.message) });
      return;
    }
    toast(data > 0 ? `${data} request${data === 1 ? "" : "s"} created` : "No driver has enough available yet", { tone: data > 0 ? "ok" : "warn" });
    load();
  };

  return (
    <section className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">Payout requests</h2>
            <p className="text-xs text-gray-700">
              {rows.length === 0 ? "Nothing is waiting to be paid." : `${rows.length} waiting, ${kes(rows.reduce((s, r) => s + r.amount, 0))} in total`}
            </p>
          </div>
          <button
            onClick={weekly}
            disabled={busy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-indigo-200 px-3 py-1.5 text-xs font-bold active:scale-95 disabled:opacity-60"
          >
            <Icon name="calendar" className="w-3.5 h-3.5" size={14} />
            Create weekly requests
          </button>
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportCsv} className="flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 font-bold rounded-xl p-3 text-sm active:scale-95">
              <Icon name="download" className="w-4 h-4" />
              Export file ({target.length})
            </button>
            <button
              onClick={() => pay(target)}
              disabled={busy}
              className="btn-shine grad-bg flex items-center justify-center gap-2 text-white font-bold rounded-xl p-3 text-sm shadow disabled:opacity-60 active:scale-95"
            >
              <Icon name="check" className="w-4 h-4" />
              Record paid ({kes(total)})
            </button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="border-t border-indigo-100">
          <button onClick={() => setSel(allOn ? [] : rows.map((r) => r.id))} className="w-full text-left px-4 py-2 text-xs font-bold text-indigo-700">
            {allOn ? "Clear selection" : "Select all"}
            <span className="text-gray-700 font-semibold">. With nothing selected, the buttons use everyone.</span>
          </button>
          {rows.map((r) => {
            const on = sel.includes(r.id);
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-t border-indigo-100">
                <button
                  onClick={() => toggle(r.id)}
                  aria-label={on ? "Deselect" : "Select"}
                  aria-pressed={on}
                  className="w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 active:scale-90"
                  style={{ borderColor: on ? "#4338ca" : "#9ca3af", background: on ? "#4338ca" : "transparent", color: "#fff" }}
                >
                  {on && <Icon name="tick" className="w-3.5 h-3.5" size={14} />}
                </button>
                <Avatar src={r.avatar_url} name={r.full_name} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{r.full_name || "Driver"}</p>
                  <p className="text-xs text-gray-700 truncate">{r.phone}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-extrabold">{kes(r.amount)}</p>
                  <Pill text={r.note === "Weekly payout" ? "Weekly" : "Requested"} color={r.note === "Weekly payout" ? "#6366f1" : "#d97706"} />
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => pay([r])} aria-label="Record as paid" className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center active:scale-90">
                    <Icon name="check" className="w-4 h-4" size={16} />
                  </button>
                  <button onClick={() => reject(r)} aria-label="Reject" className="w-8 h-8 rounded-full bg-white border-2 border-red-200 text-red-600 flex items-center justify-center active:scale-90">
                    <Icon name="close" className="w-4 h-4" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}