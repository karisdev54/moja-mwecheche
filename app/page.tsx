"use client";
import Link from "next/link";
import { motion } from "motion/react";
import AutoRedirect from "@/components/AutoRedirect";
import Brand from "@/components/Brand";
import PlateBadge from "@/components/PlateBadge";
import Reveal from "@/components/motion/Reveal";
import { Item, Stagger } from "@/components/motion/Stagger";

const STEPS = [
  { n: "1", title: "Tell us the task", text: "Airport transfer, wedding, business trip or an errand. Choose Now or Later." },
  { n: "2", title: "A nearby driver accepts", text: "Verified drivers close to you see your request. You see their name, rating and car plate." },
  { n: "3", title: "Pay with M-Pesa", text: "Pay securely in the app. The driver starts once payment is confirmed." },
];

const SAFETY = [
  { icon: "🪪", text: "Every driver uploads an ID and driving licence that we check before they can go online" },
  { icon: "📍", text: "See your driver's rating, car plate and live position on the map" },
  { icon: "🔒", text: "Pay only through the app, never in cash on the road" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden text-gray-900" style={{ background: "var(--bg)" }}>
      <AutoRedirect />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-6 pb-20">
        <div className="aurora pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <Brand />
            <Link href="/login" className="glass rounded-full px-4 py-2 text-sm font-semibold">
              Log in
            </Link>
          </div>

          <Stagger className="text-center pt-14 space-y-5" gap={0.1}>
            <Item>
              <span className="glass inline-block rounded-full px-4 py-1 text-xs font-bold">
                🚗 Hire a driver in minutes
              </span>
            </Item>
            <Item>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
                Hire a <span className="gradient-text">trusted driver</span> for any task or occasion
              </h1>
            </Item>
            <Item>
              <p className="text-lg text-gray-700">
                A few hours, a wedding, or a trip across town. Book a verified driver near you.
              </p>
            </Item>
            <Item>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/login?mode=signup&role=customer"
                    className="btn-shine grad-bg block text-white font-bold rounded-2xl px-6 py-4 shadow-xl"
                  >
                    Hire a driver
                  </Link>
                </motion.div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/login?mode=signup&role=driver"
                    className="glass block font-bold rounded-2xl px-6 py-4"
                  >
                    Become a driver
                  </Link>
                </motion.div>
              </div>
            </Item>
          </Stagger>

          {/* A preview of the app, floating gently */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-14"
          >
            <div className="float glass mx-auto max-w-xs rounded-3xl p-4 shadow-2xl space-y-3 text-left">
              <div className="flex items-center justify-between">
                <p className="font-bold">Airport transfer</p>
                <span className="text-xs font-bold bg-blue-100 text-blue-900 rounded-full px-2 py-1">Accepted</span>
              </div>
              <PlateBadge plate="KDA123A" />
              <div className="h-2 rounded-full bg-indigo-200 overflow-hidden">
                <motion.div
                  className="h-2 rounded-full grad-bg"
                  initial={{ width: "10%" }}
                  animate={{ width: "70%" }}
                  transition={{ delay: 1.2, duration: 1.6, ease: "easeInOut" }}
                />
              </div>
              <p className="text-xs">Your driver is on the way. Preview</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-12 max-w-3xl mx-auto">
        <Reveal>
          <h2 className="text-2xl font-bold text-center mb-8">How it works</h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="lift bg-white rounded-2xl shadow p-5 space-y-2 h-full">
                <div className="grad-bg w-10 h-10 rounded-full text-white flex items-center justify-center font-bold">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-gray-700">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section className="px-4 py-12 max-w-2xl mx-auto">
        <Reveal>
          <div className="bg-white rounded-3xl shadow-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold">Safety first</h2>
            {SAFETY.map((s, i) => (
              <Reveal key={s.text} delay={i * 0.1} y={14}>
                <div className="flex gap-3 items-start">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-gray-800">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Driver call to action */}
      <section className="px-4 py-12 max-w-2xl mx-auto text-center space-y-4">
        <Reveal>
          <h2 className="text-2xl font-bold">Are you a driver?</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-gray-700">
            Sign up, upload your documents, get approved, and start accepting jobs near you. Get paid weekly by M-Pesa.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <motion.div whileTap={{ scale: 0.97 }} className="inline-block">
            <Link
              href="/login?mode=signup&role=driver"
              className="btn-shine grad-bg inline-block text-white font-bold rounded-2xl px-6 py-4 shadow-xl"
            >
              Join as a driver
            </Link>
          </motion.div>
        </Reveal>
      </section>

      <footer className="px-4 py-8 text-center text-sm text-gray-700 space-x-4">
        <Link href="/terms" className="underline">Terms</Link>
        <Link href="/privacy" className="underline">Privacy</Link>
      </footer>
    </main>
  );
}