
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase";

type AllocationRow = {
  id: number;
  player_id: number;
  hostel_id: number;
  start_date: string;
  duration_days: number;
  expected_checkout: string;
  checked_in: boolean;
  security_deposit: number | null;
  players: {
    player_name: string;
    college: string | null;
    sports: string | null;
    gender: string | null;
    role: string | null;
    phone: string | null;
  } | null;
  hostels: {
    name: string;
    code: string | null;
    capacity: number;
  } | null;
};

export default function AllocationsPage() {
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAllocations();
  }, []);

  async function loadAllocations() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("active_allocations")
      .select(`
        id,
        player_id,
        hostel_id,
        start_date,
        duration_days,
        expected_checkout,
        checked_in,
        security_deposit,
        players (
          player_name,
          college,
          sports,
          gender,
          role,
          phone
        ),
        hostels (
          name,
          code,
          capacity
        )
      `)
      .order("start_date", { ascending: true });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as AllocationRow[]);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <a href="/" className="text-cyan-400 hover:underline">
          ← Dashboard
        </a>

        <h1 className="mt-6 text-3xl font-bold">
          Currently Allocated People
        </h1>

        <p className="mt-2 text-slate-400">
          Participants with accommodation allocation records.
        </p>

        <button
          onClick={() => void loadAllocations()}
          className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950"
        >
          Refresh
        </button>

        {loading && <p className="mt-5">Loading allocations...</p>}

        {error && (
          <p className="mt-5 rounded-lg bg-red-950 p-4 text-red-200">
            Could not load allocations: {error}
          </p>
        )}

        {!loading && !error && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="p-3">Participant</th>
                  <th className="p-3">College</th>
                  <th className="p-3">Sport</th>
                  <th className="p-3">Hostel</th>
                  <th className="p-3">Start date</th>
                  <th className="p-3">Nights</th>
                  <th className="p-3">Checkout</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800">
                    <td className="p-3">
                      {a.players?.player_name ?? `Player #${a.player_id}`}
                    </td>
                    <td className="p-3">{a.players?.college ?? "—"}</td>
                    <td className="p-3">{a.players?.sports ?? "—"}</td>
                    <td className="p-3">
                      {a.hostels?.name ?? "Unknown"}
                      {a.hostels?.code ? ` (${a.hostels.code})` : ""}
                    </td>
                    <td className="p-3">{a.start_date}</td>
                    <td className="p-3">{a.duration_days}</td>
                    <td className="p-3">
                      {new Date(a.expected_checkout).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {a.checked_in ? "Checked in" : "Allocated"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rows.length === 0 && (
              <p className="p-5 text-slate-400">
                No accommodation allocations found.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
