
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase";

type Hostel = {
  id: number;
  name: string;
  code: string | null;
  capacity: number;
};

type Allocation = {
  id: number;
  hostel_id: number;
  start_date: string;
  duration_days: number;
  checked_in: boolean;
};

const dates = [
  { label: "October 29", value: "2026-10-29" },
  { label: "October 30", value: "2026-10-30" },
  { label: "October 31", value: "2026-10-31" },
];

const links = [
  {
    title: "Participant Check-in",
    description: "Register participants, allocate hostels, and check guests in.",
    href: "/check-in",
    icon: "📝",
  },
  {
    title: "Currently Allocated",
    description: "See everyone with a saved accommodation allocation.",
    href: "/allocations",
    icon: "🏨",
  },
  {
    title: "Participant Checkout",
    description: "Release accommodation and preserve stay history.",
    href: "/checkout",
    icon: "🔑",
  },
  {
    title: "Players Database",
    description: "Search and manage participant profiles.",
    href: "/players",
    icon: "👥",
  },

{
  title: "Checked-out Participants",
  description: "Search previous stays and export checkout history to Excel.",
  href: "/checked-out",
  icon: "📋",
},

];

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function occupiesNight(a: Allocation, date: string) {
  return a.start_date <= date && addDays(a.start_date, a.duration_days) > date;
}

export default function Home() {
  const [day, setDay] = useState("2026-10-30");
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [playersCount, setPlayersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const [hostelResult, allocationResult, playerResult] = await Promise.all([
      supabase
        .from("hostels")
        .select("id, name, code, capacity")
        .order("name"),
      supabase
        .from("active_allocations")
        .select("id, hostel_id, start_date, duration_days, checked_in"),
      supabase
        .from("players")
        .select("id", { count: "exact", head: true }),
    ]);

    const problem =
      hostelResult.error || allocationResult.error || playerResult.error;

    if (problem) {
      setError(problem.message);
      setLoading(false);
      return;
    }

    setHostels((hostelResult.data ?? []) as Hostel[]);
    setAllocations((allocationResult.data ?? []) as Allocation[]);
    setPlayersCount(playerResult.count ?? 0);
    setLoading(false);
  }

  const capacity = hostels.reduce((sum, h) => sum + h.capacity, 0);

  const occupied = allocations.filter((a) => occupiesNight(a, day)).length;
  const available = Math.max(0, capacity - occupied);
  const occupancyRate =
    capacity > 0 ? ((occupied / capacity) * 100).toFixed(1) : "0.0";

  const checkedIn = allocations.filter((a) => a.checked_in).length;

  function hostelOccupied(hostelId: number) {
    return allocations.filter(
      (a) => a.hostel_id === hostelId && occupiesNight(a, day)
    ).length;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl p-6 md:p-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-cyan-400">
              SURGE26
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Accommodation Manager
            </h1>
            <p className="mt-2 text-slate-400">
              Hostel allocation and daily capacity overview
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="rounded-lg border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800"
          >
            ↻ Refresh data
          </button>
        </header>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950 p-6">
          <h2 className="text-2xl font-bold">Event Control Centre</h2>
          <p className="mt-2 text-slate-400">
            Manage registrations, allocations, check-ins, and checkouts from one place.
          </p>
          <a
            href="/check-in"
            className="mt-5 inline-block rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Open Participant Check-in →
          </a>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">
            Could not load dashboard data: {error}
          </div>
        )}

        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Capacity",
              value: capacity,
              note: "Across all loaded hostels",
            },
            {
              label: "Occupied Beds",
              value: occupied,
              note: dates.find((d) => d.value === day)?.label ?? day,
            },
            {
              label: "Beds Available",
              value: available,
              note: "Selected night",
            },
            {
              label: "Registered Participants",
              value: playersCount,
              note: `${allocations.length} active allocation records`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold">
                {loading ? "…" : stat.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{stat.note}</p>
            </div>
          ))}
        </section>

        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Hostel Capacity</h2>
              <p className="mt-1 text-sm text-slate-400">
                Live occupancy calculated from saved allocation dates
              </p>
            </div>

            <select
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
            >
              {dates.map((date) => (
                <option key={date.value} value={date.value}>
                  {date.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5 text-sm text-slate-400">
            Overall occupancy: {occupancyRate}% · {checkedIn} allocation(s) marked checked in
          </div>

          <div className="space-y-5">
            {hostels.map((hostel) => {
              const used = hostelOccupied(hostel.id);
              const remaining = Math.max(0, hostel.capacity - used);
              const percentage =
                hostel.capacity > 0
                  ? Math.min(100, (used / hostel.capacity) * 100)
                  : 0;

              return (
                <div key={hostel.id}>
                  <div className="mb-2 flex flex-wrap justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {hostel.name}
                      {hostel.code && (
                        <span className="text-slate-500"> ({hostel.code})</span>
                      )}
                    </span>
                    <span className="text-slate-400">
                      {used} occupied · {remaining} remaining · {hostel.capacity} total
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {!loading && hostels.length === 0 && (
              <p className="text-amber-300">
                No hostels returned. Check the Supabase hostels table and database access.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold">All Management Pages</h2>
          <p className="mt-1 text-sm text-slate-400">
            Quick links to the SURGE26 tools.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-cyan-700 hover:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{link.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {link.description}
                    </p>
                  </div>
                  <span className="text-3xl">{link.icon}</span>
                </div>
                <p className="mt-5 font-semibold text-cyan-400">
                  Open page →
                </p>
              </a>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
          SURGE26 · Accommodation Management System
        </footer>
      </div>
    </main>
  );
}
