
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../src/lib/supabase";
import * as XLSX from "xlsx";

type HistoryRecord = {
  id: number;
  original_allocation_id: number | null;
  player_id: number;
  player_name: string;
  college: string | null;
  sports: string | null;
  phone: string | null;
  role: string | null;
  hostel_name: string;
  start_date: string;
  duration_days: number;
  expected_checkout: string | null;
  checked_in: boolean;
  security_deposit: number;
  released_at: string;
  release_reason: string;
};

const PAGE_SIZE = 500;

export default function CheckedOutPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      let allRecords: HistoryRecord[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("accommodation_history")
          .select(`
            id,
            original_allocation_id,
            player_id,
            player_name,
            college,
            sports,
            phone,
            role,
            hostel_name,
            start_date,
            duration_days,
            expected_checkout,
            checked_in,
            security_deposit,
            released_at,
            release_reason
          `)
          .order("released_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          throw new Error(error.message);
        }

        const batch = (data ?? []) as HistoryRecord[];
        allRecords = allRecords.concat(batch);

        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      setRecords(allRecords);
      setNotice(`${allRecords.length} checkout record(s) loaded.`);
    } catch (e) {
      setRecords([]);
      setError(
        e instanceof Error ? e.message : "Could not load checkout history."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;

    return records.filter((r) =>
      [
        r.player_name,
        r.college,
        r.sports,
        r.phone,
        r.role,
        r.hostel_name,
        r.release_reason,
      ].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [records, search]);

  function exportExcel() {
    const rows = filtered.map((r) => ({
      "History ID": r.id,
      "Participant": r.player_name,
      "Player ID": r.player_id,
      "College": r.college ?? "",
      "Sport": r.sports ?? "",
      "Phone": r.phone ?? "",
      "Role": r.role ?? "",
      "Hostel": r.hostel_name,
      "Arrival Date": r.start_date,
      "Duration (Nights)": r.duration_days,
      "Expected Checkout": r.expected_checkout ?? "",
      "Actual Release Time": r.released_at,
      "Checked In": r.checked_in ? "Yes" : "No",
      "Security Deposit (₹)": r.security_deposit ?? 0,
      "Release Reason": r.release_reason,
      "Original Allocation ID": r.original_allocation_id ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.book_append_sheet(workbook, worksheet, "Checked Out");
    XLSX.writeFile(workbook, "SURGE26_Checked_Out_Participants.xlsx");

    setNotice(`Exported ${rows.length} checkout record(s) to Excel.`);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <a href="/" className="text-sm text-cyan-400 hover:underline">
          ← Back to dashboard
        </a>

        <header className="my-7">
          <p className="text-sm font-bold tracking-[0.3em] text-cyan-400">
            SURGE26
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Checked-out Participants
          </h1>
          <p className="mt-2 text-slate-400">
            Historical accommodation records for participants who have been released.
            Player profiles remain in the database.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">
            <strong>Database error:</strong> {error}
          </div>
        )}

        {notice && (
          <div role="status" className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-emerald-200">
            {notice}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total checkout records</p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "…" : records.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Matching records</p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "…" : filtered.length}
            </p>
          </div>

          <div className="flex items-center rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <button
              type="button"
              onClick={exportExcel}
              disabled={loading || filtered.length === 0}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              Export to Excel
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Checkout history</h2>

            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, college, sport, hostel, or release reason..."
            className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white"
          />

          {loading ? (
            <p className="py-8 text-center text-slate-400">
              Loading checkout history...
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-slate-400">
              No checkout records found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="p-3">Participant</th>
                    <th className="p-3">College</th>
                    <th className="p-3">Sport</th>
                    <th className="p-3">Hostel</th>
                    <th className="p-3">Arrival</th>
                    <th className="p-3">Nights</th>
                    <th className="p-3">Released at</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Deposit (₹)</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-800 hover:bg-slate-800/50"
                    >
                      <td className="p-3 font-medium">{r.player_name}</td>
                      <td className="p-3">{r.college || "—"}</td>
                      <td className="p-3">{r.sports || "—"}</td>
                      <td className="p-3">{r.hostel_name}</td>
                      <td className="p-3">{r.start_date}</td>
                      <td className="p-3">{r.duration_days}</td>
                      <td className="p-3">
                        {r.released_at
                          ? new Date(r.released_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="p-3">{r.release_reason || "—"}</td>
                      <td className="p-3">
                        ₹{Number(r.security_deposit ?? 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <nav className="mt-6 flex flex-wrap gap-4 text-sm">
          <a href="/allocations" className="text-cyan-400 hover:underline">
            Currently allocated →
          </a>
          <a href="/checkout" className="text-cyan-400 hover:underline">
            Checkout page →
          </a>
          <a href="/players" className="text-cyan-400 hover:underline">
            Players database →
          </a>
        </nav>
      </div>
    </main>
  );
}
