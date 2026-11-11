"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { finish, useDialog, type DialogReq } from "@/lib/dialog";
import { Icon } from "@/components/AdminUI";

function Box({ d }: { d: DialogReq }) {
  const [text, setText] = useState(d.kind === "prompt" ? d.initial ?? "" : "");
  const [err, setErr] = useState("");
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const cancelValue = d.kind === "confirm" ? false : null;
  const color = d.danger ? "#dc2626" : "#4338ca";
  const iconName = d.danger ? "alert" : d.kind === "alert" ? "info" : d.kind === "prompt" ? "edit" : "help";

  useEffect(() => {
    field.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(d, cancelValue);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d, cancelValue]);

  const ok = () => {
    if (d.kind === "prompt") {
      const v = text.trim();
      if (d.required && !v) return setErr("Please fill this in.");
      if (d.minLength && v.length < d.minLength) return setErr(`Please write at least ${d.minLength} characters.`);
      return finish(d, v);
    }
    finish(d, true);
  };

  const max = d.kind === "prompt" ? d.maxLength ?? (d.multiline ? 300 : 200) : 0;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/55 page-fade"
      onClick={() => finish(d, cancelValue)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={d.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 pop-in"
      >
        <div
          className="h-1.5"
          style={{
            background: d.danger ? "linear-gradient(90deg,#dc2626,#f97316)" : "linear-gradient(90deg,#4338ca,#0e7490)",
          }}
        />
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))`, color }}
            >
              <Icon name={iconName} className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold leading-tight">{d.title}</h2>
              {d.message && <p className="text-sm text-gray-700 mt-1">{d.message}</p>}
            </div>
          </div>

          {d.kind === "prompt" && (
            <div className="space-y-1">
              {d.multiline ? (
                <textarea
                  ref={field}
                  rows={3}
                  maxLength={max}
                  className="w-full border-2 border-indigo-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  placeholder={d.placeholder}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setErr("");
                  }}
                />
              ) : (
                <input
                  ref={field}
                  maxLength={max}
                  className="w-full border-2 border-indigo-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  placeholder={d.placeholder}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setErr("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && ok()}
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-red-600">{err}</p>
                <p className="text-xs text-gray-700 shrink-0">
                  {text.length}/{max}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {d.kind !== "alert" && (
              <button
                onClick={() => finish(d, cancelValue)}
                className="flex-1 bg-white border-2 border-indigo-200 font-bold rounded-xl p-3.5 active:scale-95"
              >
                {d.cancelText ?? "Cancel"}
              </button>
            )}
            <button
              onClick={ok}
              className={`flex-1 font-bold rounded-xl p-3.5 text-white active:scale-95 ${
                d.danger ? "bg-red-600" : "btn-shine grad-bg"
              }`}
            >
              {d.confirmText ?? (d.kind === "alert" ? "OK" : "Confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DialogHost() {
  const d = useDialog();
  if (!d || typeof document === "undefined") return null;
  return createPortal(<Box key={d.id} d={d} />, document.body);
}