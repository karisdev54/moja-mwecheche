import Link from "next/link";
import AutoRedirect from "@/components/AutoRedirect";

const STEPS = [
  { n: "1", title: "Tell us the task", text: "Airport transfer, wedding, business trip or an errand. Pick a date, time and duration." },
  { n: "2", title: "A nearby driver accepts", text: "Verified drivers close to you see your request and one accepts. You see their name, rating and live position." },
  { n: "3", title: "Pay with M-Pesa", text: "Pay securely by M-Pesa. The driver starts the job once payment is confirmed." },
];

const SAFETY = [
  "Every driver uploads an ID and driving licence that we check before they can go online",
  "See your driver's rating and track them live on the map",
  "Pay only through the app, never in cash on the road",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <AutoRedirect />

      <section className="px-4 pt-14 pb-12 text-center max-w-2xl mx-auto space-y-5">
        <h1 className="text-4xl font-bold">Hire a trusted driver for any task or occasion</h1>
        <p className="text-lg text-gray-700">
          Need a driver for a few hours, a wedding or a trip? Book a verified driver near you in minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/login?mode=signup&role=customer" className="bg-black text-white rounded-xl px-6 py-4 font-semibold">
            Hire a driver
          </Link>
          <Link href="/login?mode=signup&role=driver" className="bg-white border-2 border-indigo-300 rounded-xl px-6 py-4 font-semibold">
            Become a driver
          </Link>
        </div>
        <p className="text-sm text-gray-700">
          Already have an account? <Link href="/login" className="bg-black text-white rounded-xl px-6 py-4 font-semibold">Log in</Link>
        </p>
      </section>

      <section className="px-4 py-10 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-white rounded-2xl shadow p-5 space-y-2">
              <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold">{s.n}</div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-gray-700">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow p-6 space-y-3">
          <h2 className="text-2xl font-bold">Safety first</h2>
          <ul className="space-y-2 text-gray-800 list-disc pl-5">
            {SAFETY.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-10 max-w-2xl mx-auto text-center space-y-3">
        <h2 className="text-2xl font-bold">Are you a driver?</h2>
        <p className="text-gray-700">
          Sign up, upload your documents, get approved, and start accepting jobs near you. Get paid weekly by M-Pesa.
        </p>
        <Link href="/login?mode=signup&role=driver" className="inline-block bg-black text-white rounded-xl px-6 py-4 font-semibold">
          Join as a driver
        </Link>
      </section>

      <footer className="px-4 py-8 text-center text-sm text-gray-700 space-x-4">
        <Link href="/terms" className="underline">Terms</Link>
        <Link href="/privacy" className="underline">Privacy</Link>
      </footer>
    </main>
  );
}