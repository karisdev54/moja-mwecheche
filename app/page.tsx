import Link from "next/link";
import AutoRedirect from "@/components/AutoRedirect";
import Brand from "@/components/Brand";
import PlateBadge from "@/components/PlateBadge";
import JobTracker from "@/components/JobTracker";
import { Icon, Tile } from "@/components/AdminUI";

const FEATURES = [
  { icon: "verify", color: "#6366f1", title: "Verified drivers", text: "ID and licence checked" },
  { icon: "wallet", color: "#10b981", title: "Pay with M-Pesa", text: "Secure, in the app" },
  { icon: "pin", color: "#0ea5e9", title: "Live tracking", text: "See your driver arrive" },
];

const STEPS = [
  { icon: "list", title: "Tell us the task", text: "Airport transfer, wedding, business trip or an errand. Choose Now or Later." },
  { icon: "car", title: "A driver accepts", text: "Verified drivers near you see your request. You see their name, rating and car plate." },
  { icon: "wallet", title: "Pay and go", text: "Pay securely in the app. The driver starts once your payment is confirmed." },
];

const SAFETY = [
  { icon: "idcard", title: "Documents checked", text: "Every driver uploads an ID and driving licence that we review before they can go online." },
  { icon: "car", title: "Verified vehicles", text: "Car plates are checked against the logbook, so you know which car to look for." },
  { icon: "lock", title: "Safe payments", text: "Pay only through the app, never in cash on the road." },
];

const PERKS = ["Keep most of every fare", "Weekly payouts to your M-Pesa", "Jobs near you, on your schedule", "Build your reputation with ratings"];

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden text-gray-900" style={{ background: "var(--bg)" }}>
      <AutoRedirect />

      <section className="relative overflow-hidden px-4 pt-5 pb-16">
        <div className="aurora pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <header className="flex items-center justify-between">
            <Brand />
            <Link href="/login" className="glass inline-flex items-center rounded-full px-4 py-2 text-sm font-bold active:scale-95">
              Log in
            </Link>
          </header>

          <div className="stagger text-center pt-12 space-y-5">
            <div>
              <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold">
                <span className="text-indigo-600">
                  <Icon name="bolt" className="w-3.5 h-3.5" />
                </span>
                Hire a driver in minutes
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight">
              Hire a <span className="gradient-text">trusted driver</span> for any task or occasion
            </h1>
            <p className="text-lg text-gray-700 max-w-md mx-auto">
              A few hours, a wedding, or a trip across town. Book a verified driver near you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link href="/login?mode=signup&role=customer" className="btn-shine grad-bg inline-flex items-center justify-center gap-2 text-white font-bold rounded-2xl px-6 py-4 shadow-xl active:scale-95">
                <Icon name="car" className="w-5 h-5" />
                Hire a driver
              </Link>
              <Link href="/login?mode=signup&role=driver" className="glass inline-flex items-center justify-center gap-2 font-bold rounded-2xl px-6 py-4 active:scale-95">
                <Icon name="key" className="w-5 h-5" />
                Become a driver
              </Link>
            </div>
          </div>

          <div className="mt-12 anim-rise" style={{ animationDelay: "0.5s" }}>
            <div className="float mx-auto max-w-xs bg-white rounded-3xl shadow-2xl overflow-hidden text-left">
              <div className="h-1.5 grad-bg" />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">Airport transfer</p>
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "color-mix(in srgb, #2563eb 14%, var(--surface))", color: "#2563eb" }}>
                    Accepted
                  </span>
                </div>
                <JobTracker status="accepted" paid />
                <div className="flex items-center gap-3 rounded-xl border border-indigo-100 p-3 stagger">
                  <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">J</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Your driver</p>
                    <p className="text-sm font-semibold">James M.</p>
                  </div>
                  <PlateBadge plate="KDA123A" small verified />
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-700 mt-3">A preview of the app</p>
          </div>
        </div>
      </section>

      <section className="px-4 -mt-4 pb-6 max-w-3xl mx-auto">
        <div className="grid grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="lift bg-white rounded-2xl shadow p-3 text-center space-y-2">
              <div className="flex justify-center">
                <Tile name={f.icon} color={f.color} />
              </div>
              <p className="text-sm font-bold leading-tight">{f.title}</p>
              <p className="text-xs text-gray-700">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-12 max-w-3xl mx-auto">
        <h2 className="text-2xl font-extrabold tracking-tight text-center">How it works</h2>
        <p className="text-sm text-gray-700 text-center mt-1 mb-8">Three steps from request to arrival</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="lift bg-white rounded-2xl shadow p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Tile name={s.icon} color="#6366f1" size="w-11 h-11" />
                <span className="text-3xl font-extrabold text-indigo-100">{i + 1}</span>
              </div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="text-sm text-gray-700">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-lg p-6 space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Safety first</h2>
            <p className="text-sm text-gray-700">Trust is built into every trip.</p>
          </div>
          {SAFETY.map((s) => (
            <div key={s.title} className="flex items-start gap-3">
              <Tile name={s.icon} color="#10b981" />
              <div>
                <p className="font-bold">{s.title}</p>
                <p className="text-sm text-gray-700">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-10 max-w-2xl mx-auto">
        <div
          className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl sheen space-y-4"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div>
            <h2 className="text-yellow-400 text-2xl font-extrabold tracking-tight">Are you a driver?</h2>
            <p className="text-sm text-white/85 mt-1">Sign up, upload your documents, get approved, and start earning near you.</p>
          </div>
          <ul className="grid gap-2">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-sm">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="tick" className="w-3 h-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <Link href="/login?mode=signup&role=driver" className="btn-shine inline-flex items-center justify-center gap-2 bg-white text-indigo-800 font-bold rounded-2xl px-6 py-3.5 active:scale-95">
            Join as a driver
            <Icon name="chevron" className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="px-4 py-8 text-center space-y-2">
        <div className="flex justify-center">
          <Brand size={32} />
        </div>
        <p className="text-sm text-gray-700 space-x-4">
          <Link href="/terms" className="btn-shine inline-flex items-center justify-center gap-2 bg-white text-indigo-800 font-bold rounded-2xl px-6 py-3.5 active:scale-95">Terms</Link>
          <Link href="/privacy" className="btn-shine inline-flex items-center justify-center gap-2 bg-white text-indigo-800 font-bold rounded-2xl px-6 py-3.5 active:scale-95">Privacy</Link>
         
        </p>
      </footer>
    </main>
  );
}