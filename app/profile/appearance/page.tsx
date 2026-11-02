"use client";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav from "@/components/BottomNav";

export default function AppearancePage() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4 text-gray-900 stagger">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Appearance</h1>
          <Link href="/profile" className="text-sm underline font-semibold">Back</Link>
        </div>
        <ThemeToggle />
      </div>
      <BottomNav />
    </main>
  );
}