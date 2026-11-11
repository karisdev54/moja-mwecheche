"use client";
import ThemeToggle from "@/components/ThemeToggle";
import { Icon, PageHeader } from "@/components/AdminUI";
import { useTheme } from "@/lib/theme";

export default function AppearancePage() {
  const showing = useTheme();
  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader title="Appearance" subtitle="Choose how the app looks" href="/profile" />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen flex items-center gap-4"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center float">
            <Icon name={showing === "dark" ? "moon" : "sun"} className="w-6 h-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Showing now</p>
            <p className="text-2xl font-extrabold tracking-tight">{showing === "dark" ? "Dark mode" : "Light mode"}</p>
          </div>
        </section>

        <ThemeToggle />

        <section className="bg-white rounded-2xl shadow p-4 flex items-start gap-3">
          <span className="text-indigo-600 mt-0.5">
            <Icon name="info" className="w-5 h-5" />
          </span>
          <p className="text-sm text-gray-800">
            Auto switches between light and dark with your phone&apos;s own setting. Your choice is saved on this device.
          </p>
        </section>
      </div>
    </main>
  );
}