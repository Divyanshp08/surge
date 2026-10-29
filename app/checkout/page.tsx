
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
    phone: string | null;
    role: string | null;
  } | null;
  hostels: {
    name: string;
    code: string | null;
  } | null;
};

export default function CheckoutPage() {
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
          phone,
          role
        ),
        hostels (
          name,
          code
        )
      `)
      .order("expected_checkout", { ascending: true });

    if (error) {
      setError(`Could not load allocations: ${error.message}`);
      setAllocations([]);
    } else {
      setAllocations((data ?? []) as unknown as AllocationRow[]);
    }

    setLoading(false);
  }

  async function checkout(a: AllocationRow) {
    const name = a.players?.player_name ?? `Player #${a.player_id}`;
    const hostelName = a.hostels?.name ?? "Unknown hostel";

    const confirmed = window.confirm(
      `Check out ${name} from ${hostelName}?\n\nTheir allocation will be moved to accommodation history and removed from active allocations. Their player profile will remain.`
    );

    if (!confirmed) return;

    setSavingId(a.id);
    setError("");
    setMessage("");

    try {
      // Fetch the latest participant details for the history snapshot.
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("player_name, college, sports, phone, role")
        .eq("id", a.player_id)
        .single();

      if (playerError) {
        throw new Error(`Could not load participant: ${playerError.message}`);
      }

      const { data: hostel, error: hostelError } = await supabase
        .from("hostels")
        .select("name")
        .eq("id", a.hostel_id)
        .single();

      if (hostelError) {
        throw new Error(`Could not load hostel: ${hostelError.message}`);
      }

      // Preserve the allocation as a permanent history record.
      const { error: historyError } = await supabase
        .from("accommodation_history")
        .insert({
          original_allocation_id: a.id,
          player_id: a.player_id,
          college: player.college,
          sports: player.sports,
          player_name: player.player_name,
          phone: player.phone,
          role: player.role,
          hostel_name: hostel.name,
          start_date: a.start_date,
          duration_days: a.duration_days,
          expected_checkout: a.expected_checkout,
          checked_in: a.checked_in,
          security_deposit: a.security_deposit ?? 0,
          released_at: new Date().toISOString(),
          release_reason: "manual",
        });

      if (historyError) {
        throw new Error(`Could not save checkout history: ${historyError.message}`);
      }

      // Remove only the active allocation, never the player profile.
      const { data: deleted, error: deleteError } = await supabase
        .from("active_allocations")
        .delete()
        .eq("id", a.id)
        .select("id");

      if (deleteError) {
        throw new Error(
          `History was saved, but active allocation could not be removed: ${deleteError.message}. Do not retry blindly; check accommodation_history first.`
        );
      }

      if (!deleted || deleted.length === 0) {
        throw new Error(
          "History was saved, but no active allocation was removed. Check the database before retrying."
        );
      }

      setMessage(`${name} has been checked out. Their profile remains saved.`);
      await loadAllocations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setSavingId(null);
    }
  }

  const filtered = allocations.filter((a) => {
    const text = [
      a.players?.player_name,
      a.players?.college,
      a.hostels?.name,
      a.hostels?.code,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <a href="/" className="text-sm text-cyan-400 hover:underline">
          ← Dashboard
        </a>

        <h1 className="mt-6 text-3xl font-bold">Participant Checkout</h1>
        <p className="mt-2 text-slate-400">
          Check out participants and preserve their accommodation history.
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-950 p-4 text-red-200">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-5 rounded-lg bg-emerald-950 p-4 text-emerald-200">
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participant or hostel..."
            className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-900 p-3 text-white"
          />

          <button
            type="button"
            onClick={() => void loadAllocations()}
            className="rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-slate-400">Loading active allocations...</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="p-3">Participant</th>
                  <th className="p-3">College</th>
                  <th className="p-3">Hostel</th>
                  <th className="p-3">Start date</th>
                  <th className="p-3">Checkout date</th>
                  <th className="p-3">Check-in status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800">
                    <td className="p-3">
                      {a.players?.player_name ?? `Player #${a.player_id}`}
                    </td>
                    <td className="p-3">{a.players?.college ?? "—"}</td>
                    <td className="p-3">
                      {a.hostels?.name ?? "Unknown"}
                      {a.hostels?.code ? ` (${a.hostels.code})` : ""}
                    </td>
                    <td className="p-3">{a.start_date}</td>
                    <td className="p-3">
                      {new Date(a.expected_checkout).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {a.checked_in ? "Checked in" : "Not checked in"}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        disabled={savingId !== null}
                        onClick={() => void checkout(a)}
                        className="whitespace-nowrap rounded-lg bg-rose-500 px-3 py-2 font-semibold text-white disabled:opacity-50"
                      >
                        {savingId === a.id ? "Checking out..." : "Check out"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <p className="p-5 text-slate-400">
                No matching active allocations found.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
