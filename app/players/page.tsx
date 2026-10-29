
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../src/lib/supabase";

type Player = {
  id: number;
  player_name: string;
  college: string | null;
  sports: string | null;
  phone: string | null;
  role: string | null;
  security_deposit: number | null;
};

const emptyForm = {
  player_name: "",
  college: "",
  sports: "",
  phone: "",
  role: "Player",
  security_deposit: "0",
};

const PAGE_SIZE = 500;

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      let allPlayers: Player[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("players")
          .select(
            "id, player_name, college, sports, phone, role, security_deposit"
          )
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          throw new Error(
            `${error.message} (Code: ${error.code ?? "unknown"})`
          );
        }

        const batch = (data ?? []) as Player[];
        allPlayers = allPlayers.concat(batch);

        if (batch.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      setPlayers(allPlayers);
      setNotice(
        `Database connection successful. ${allPlayers.length} player records loaded.`
      );
    } catch (e) {
      setPlayers([]);
      setError(
        e instanceof Error ? e.message : "Could not load player records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return players;

    return players.filter((p) =>
      [p.player_name, p.college, p.sports, p.phone, p.role].some((value) =>
        String(value ?? "").toLowerCase().includes(q)
      )
    );
  }, [players, search]);

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const deposit = Number(form.security_deposit);

    if (!Number.isFinite(deposit) || deposit < 0) {
      setError("Enter a valid, non-negative security deposit.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("players").insert({
      player_name: form.player_name.trim(),
      college: form.college.trim() || null,
      sports: form.sports.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      security_deposit: deposit,
    });

    if (error) {
      setError(`Could not add player: ${error.message}`);
    } else {
      setForm(emptyForm);
      await loadPlayers();
      setNotice("Player added successfully.");
    }

    setSaving(false);
  }

  async function updateDeposit(player: Player, value: string) {
    const deposit = Number(value);

    if (!Number.isFinite(deposit) || deposit < 0) {
      setError("Enter a valid, non-negative deposit.");
      return;
    }

    if (value.trim() === "") {
      setError("Security deposit cannot be empty.");
      return;
    }

    setError("");
    setNotice("");

    const { error } = await supabase
      .from("players")
      .update({ security_deposit: deposit })
      .eq("id", player.id);

    if (error) {
      setError(`Could not update deposit: ${error.message}`);
      return;
    }

    setPlayers((current) =>
      current.map((p) =>
        p.id === player.id ? { ...p, security_deposit: deposit } : p
      )
    );

    setNotice(`Deposit updated for ${player.player_name}.`);
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
          <h1 className="mt-2 text-3xl font-bold">Player Database</h1>
          <p className="mt-2 text-slate-400">
            Search players, manage details, and update security deposits.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200"
          >
            <strong>Database error:</strong> {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-emerald-200"
          >
            {notice}
          </div>
        )}

        <section className="mb-7 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-xl font-semibold">Add a player</h2>

          <form
            onSubmit={addPlayer}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="text-sm text-slate-300">
              Player name *
              <input
                required
                value={form.player_name}
                onChange={(e) =>
                  setForm({ ...form, player_name: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <label className="text-sm text-slate-300">
              College
              <input
                value={form.college}
                onChange={(e) =>
                  setForm({ ...form, college: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <label className="text-sm text-slate-300">
              Sport(s)
              <input
                value={form.sports}
                onChange={(e) =>
                  setForm({ ...form, sports: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <label className="text-sm text-slate-300">
              Phone
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <label className="text-sm text-slate-300">
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              >
                <option>Player</option>
                <option>Coach</option>
                <option>Alumni</option>
                <option>Official</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Security deposit (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.security_deposit}
                onChange={(e) =>
                  setForm({ ...form, security_deposit: e.target.value })
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add player"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">All players</h2>
              <p className="mt-1 text-sm text-slate-400">
                {loading
                  ? "Loading all records..."
                  : `${filtered.length} matching records out of ${players.length} loaded`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadPlayers()}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, college, sport, or phone..."
            className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          />

          {loading ? (
            <p className="py-8 text-center text-slate-400">
              Loading players in batches...
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-slate-400">
              No matching player records. Check any database error above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="p-3">Player</th>
                    <th className="p-3">College</th>
                    <th className="p-3">Sport(s)</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Deposit (₹)</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-800 hover:bg-slate-800/50"
                    >
                      <td className="p-3 font-medium">{p.player_name}</td>
                      <td className="p-3">{p.college || "—"}</td>
                      <td className="p-3">{p.sports || "—"}</td>
                      <td className="p-3">{p.phone || "—"}</td>
                      <td className="p-3">{p.role || "Player"}</td>
                      <td className="p-3">
                        <input
                          key={`${p.id}-${p.security_deposit}`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={p.security_deposit ?? 0}
                          aria-label={`Deposit for ${p.player_name}`}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (
                              value !== "" &&
                              Number(value) !== Number(p.security_deposit ?? 0)
                            ) {
                              void updateDeposit(p, value);
                            }
                          }}
                          className="w-28 rounded-md border border-slate-700 bg-slate-950 p-2"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-6 flex flex-wrap gap-4 text-sm">
          <a href="/check-in" className="text-cyan-400 hover:underline">
            Participant Check-in →
          </a>
          <a href="/allocations" className="text-cyan-400 hover:underline">
            Currently Allocated →
          </a>
          <a href="/checkout" className="text-cyan-400 hover:underline">
            Participant Checkout →
          </a>
        </footer>
      </div>
    </main>
  );
}
