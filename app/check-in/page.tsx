
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../src/lib/supabase";
import * as XLSX from "xlsx";

type Player = {
  id: number;
  player_name: string;
  college: string | null;
  sports: string | null;
  phone: string | null;
  role: string | null;
  gender?: string | null;
  security_deposit: number | null;
};

type Hostel = {
  id: number;
  name: string;
  code: string | null;
  capacity: number;
};

type Allocation = {
  id: number;
  player_id: number;
  hostel_id: number;
  start_date: string;
  duration_days: number;
  expected_checkout: string;
  checked_in: boolean;
  security_deposit: number | null;
  created_at?: string;
};

type Occupancy = {
  hostelId: number;
  occupied: number;
  remaining: number;
};

const FIRST_DATE = "2026-10-29";
const LAST_CHECKOUT = "2026-11-01";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isOccupiedOn(a: Allocation, date: string) {
  return a.start_date <= date &&
    addDays(a.start_date, a.duration_days) > date;
}

function isGir(h: Hostel) {
  return h.name.toLowerCase() === "gir";
}

function isKaziranga(h: Hostel) {
  return ["kazi", "kaziranga"].includes(h.name.toLowerCase());
}

export default function CheckInPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [savedAllocation, setSavedAllocation] = useState<Allocation | null>(null);

  const [hostel, setHostel] = useState("");
  const [proposedHostel, setProposedHostel] = useState("");
  const [startDate, setStartDate] = useState(FIRST_DATE);
  const [duration, setDuration] = useState("1");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    player_name: "",
    college: "",
    sports: "",
    phone: "",
    role: "Player",
    gender: "",
    security_deposit: "0",
  });

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white";

  useEffect(() => {
    void loadHostels();
    void loadAllocations();
  }, []);

  async function loadHostels() {
    const { data, error } = await supabase
      .from("hostels")
      .select("id, name, code, capacity")
      .order("name");

    if (error) {
      setError(`Could not load hostels: ${error.message}`);
      setHostels([]);
      return;
    }

    if (!data?.length) {
      setHostels([]);
      setError("No hostels found in Supabase. Check the hostels table.");
      return;
    }

    setHostels(data as Hostel[]);
  }

  async function loadAllocations() {
    const { data, error } = await supabase
      .from("active_allocations")
      .select(
        "id, player_id, hostel_id, start_date, duration_days, expected_checkout, checked_in, security_deposit, created_at"
      );

    if (error) {
      setError(`Could not load current allocations: ${error.message}`);
      setAllocations([]);
      return;
    }

    setAllocations((data ?? []) as Allocation[]);
  }

  async function searchPlayers(value: string) {
    setSearch(value);
    setPlayer(null);
    setSavedAllocation(null);
    setProposedHostel("");
    setHostel("");
    setResults([]);
    setMessage("");
    setError("");

    if (value.trim().length < 2) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("players")
      .select(
        "id, player_name, college, sports, phone, role, gender, security_deposit"
      )
      .ilike("player_name", `%${value.trim()}%`)
      .limit(10);

    setLoading(false);

    if (error) {
      setError(`Could not search participants: ${error.message}`);
      return;
    }

    setResults((data ?? []) as Player[]);
  }

  async function selectPlayer(p: Player) {
    setPlayer(p);
    setResults([]);
    setSearch(p.player_name);
    setSavedAllocation(null);
    setProposedHostel("");
    setHostel("");
    setError("");
    setMessage("Loading participant allocation...");

    setForm({
      player_name: p.player_name,
      college: p.college ?? "",
      sports: p.sports ?? "",
      phone: p.phone ?? "",
      role: p.role ?? "Player",
      gender: p.gender ?? "",
      security_deposit: String(p.security_deposit ?? 0),
    });

    const { data, error } = await supabase
      .from("active_allocations")
      .select(
        "id, player_id, hostel_id, start_date, duration_days, expected_checkout, checked_in, security_deposit, created_at"
      )
      .eq("player_id", p.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage("");
      setError(`Could not load allocation: ${error.message}`);
      return;
    }

    if (data) {
      const a = data as Allocation;
      setSavedAllocation(a);
      setStartDate(a.start_date);
      setDuration(String(a.duration_days));
      setHostel(String(a.hostel_id));
      setProposedHostel(String(a.hostel_id));
      setMessage(
        a.checked_in
          ? "Existing allocation found. Participant is already checked in."
          : "Existing allocation found. No new allocation has been created."
      );
    } else {
      setMessage("Participant found. Complete the accommodation details, then allocate.");
    }
  }

  function getOccupancy(hostelId: number, date: string) {
    return allocations.filter(
      (a) => a.hostel_id === hostelId && isOccupiedOn(a, date)
    ).length;
  }

  function hasCapacity(h: Hostel, start: string, nights: number) {
    for (let i = 0; i < nights; i++) {
      const night = addDays(start, i);
      const occupied = getOccupancy(h.id, night);

      // Preserve 46 Gir places for alumni by limiting non-alumni use.
      if (
        isGir(h) &&
        form.role.toLowerCase() !== "alumni" &&
        occupied >= h.capacity - 46
      ) {
        return false;
      }

      if (occupied >= h.capacity) return false;
    }

    return true;
  }

  function preferredHostels() {
    const gender = form.gender.toLowerCase();
    const alumni = form.role.toLowerCase() === "alumni";

    if (gender === "male" && alumni) {
      return [
        ...hostels.filter(isGir),
        ...hostels.filter((h) =>
          ["hemis", "marine", "kanha"].includes(h.name.toLowerCase())
        ),
      ];
    }

    if (gender === "male") {
      return [
        ...hostels.filter((h) =>
          ["hemis", "marine", "kanha"].includes(h.name.toLowerCase())
        ),
        ...hostels.filter(isGir),
      ];
    }

    if (gender === "female") {
      return [
        ...hostels.filter((h) =>
          h.name.toLowerCase() === "dibang"
        ),
        ...hostels.filter(isKaziranga),
      ];
    }

    return [];
  }

  function allocateHostel() {
    setError("");
    setMessage("");
    setProposedHostel("");
    setHostel("");

    if (!form.gender) {
      setError("Select the participant's gender before allocating.");
      return;
    }

    const nights = Number(duration);

    if (
      ![1, 2, 3].includes(nights) ||
      startDate < FIRST_DATE ||
      startDate > "2026-10-31" ||
      addDays(startDate, nights) > LAST_CHECKOUT
    ) {
      setError("Choose a stay between October 29 and November 1, 2026.");
      return;
    }

    const choices = preferredHostels();
    const available = choices.find((h) => hasCapacity(h, startDate, nights));

    if (!available) {
      setError(
        "No hostel in the participant's preference order has enough capacity for every night. Try a different date or review the allocation rules."
      );
      return;
    }

    setProposedHostel(String(available.id));
    setHostel(String(available.id));
    setMessage(
      `Suggested hostel: ${available.name}. Review the choice and press Save Allocation to confirm.`
    );
  }

  async function saveAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!hostel || !proposedHostel) {
      setError("Press Allocate Hostel first, then review the proposed hostel.");
      return;
    }

    if (!form.player_name.trim()) {
      setError("Enter a participant name.");
      return;
    }

    if (savedAllocation) {
      setError("This participant already has an allocation. Avoid creating a duplicate.");
      return;
    }

    const nights = Number(duration);
    const deposit = Number(form.security_deposit);
    const selectedHostel = hostels.find((h) => String(h.id) === hostel);

    if (!selectedHostel) {
      setError("Choose a valid hostel.");
      return;
    }

    if (
      ![1, 2, 3].includes(nights) ||
      startDate < FIRST_DATE ||
      startDate > "2026-10-31" ||
      addDays(startDate, nights) > LAST_CHECKOUT
    ) {
      setError("The stay must finish by November 1, 2026.");
      return;
    }

    if (!form.gender) {
      setError("Select gender.");
      return;
    }

    if (!Number.isFinite(deposit) || deposit < 0) {
      setError("Security deposit must be zero or more.");
      return;
    }

    setSaving(true);

    try {
      let participantId = player?.id;

      const profile = {
        player_name: form.player_name.trim(),
        college: form.college.trim() || null,
        sports: form.sports.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role,
        gender: form.gender,
        security_deposit: deposit,
      };

      if (participantId) {
        const { error: updateError } = await supabase
          .from("players")
          .update(profile)
          .eq("id", participantId);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { data, error: insertError } = await supabase
          .from("players")
          .insert(profile)
          .select("id")
          .single();

        if (insertError) throw new Error(insertError.message);
        participantId = data.id;
      }

      // Recheck capacity immediately before saving.
      await loadAllocations();

      const fresh = await supabase
        .from("active_allocations")
        .select("id, player_id, hostel_id, start_date, duration_days, expected_checkout, checked_in, security_deposit");

      if (fresh.error) throw new Error(fresh.error.message);

      const current = (fresh.data ?? []) as Allocation[];

      for (let i = 0; i < nights; i++) {
        const night = addDays(startDate, i);
        const occupied = current.filter(
          (a) => a.hostel_id === selectedHostel.id && isOccupiedOn(a, night)
        ).length;

        if (occupied >= selectedHostel.capacity) {
          throw new Error(`${selectedHostel.name} is full on ${night}. Please allocate again.`);
        }

        if (
          isGir(selectedHostel) &&
          form.role.toLowerCase() !== "alumni" &&
          occupied >= selectedHostel.capacity - 46
        ) {
          throw new Error("Gir's 46-bed alumni reserve would be affected. Choose another hostel.");
        }
      }

      const { data: saved, error: saveError } = await supabase.rpc(
        "allocate_hostel_safely",
        {
          p_player_id: participantId,
          p_hostel_id: selectedHostel.id,
          p_start_date: startDate,
          p_duration_days: nights,
          p_security_deposit: deposit,
        }
      );

      if (saveError) {
        throw new Error(
          `Could not save allocation: ${saveError.message}. Confirm the allocate_hostel_safely database function is installed.`
        );
      }

      const savedRow = Array.isArray(saved) ? saved[0] : saved;

      if (!savedRow) {
        throw new Error("Supabase did not return the saved allocation.");
      }

      setSavedAllocation(savedRow as Allocation);
      setPlayer({
        id: participantId!,
        ...profile,
      });
      setProposedHostel(String(selectedHostel.id));
      setMessage(
        `Saved successfully. ${form.player_name} is allocated to ${selectedHostel.name}.`
      );

      await loadAllocations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save allocation.");
    } finally {
      setSaving(false);
    }
  }

  async function checkIn() {
    if (!savedAllocation) return;

    setSaving(true);
    setError("");
    setMessage("");

    const { error } = await supabase
      .from("active_allocations")
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
      })
      .eq("id", savedAllocation.id)
      .eq("checked_in", false);

    setSaving(false);

    if (error) {
      setError(`Check-in failed: ${error.message}`);
      return;
    }

    setSavedAllocation({ ...savedAllocation, checked_in: true });
    setMessage(`${form.player_name} is now checked in.`);
    await loadAllocations();
  }

  async function exportExcel() {
    setError("");

    const { data, error } = await supabase
      .from("active_allocations")
      .select(
        "id, player_id, hostel_id, start_date, duration_days, expected_checkout, checked_in, security_deposit"
      )
      .order("start_date");

    if (error) {
      setError(`Excel export failed: ${error.message}`);
      return;
    }

    const playerResult = await supabase
      .from("players")
      .select("id, player_name, college, sports, phone, role, gender");

    const hostelResult = await supabase
      .from("hostels")
      .select("id, name, code, capacity");

    if (playerResult.error || hostelResult.error) {
      setError(
        `Could not load export details: ${playerResult.error?.message ?? hostelResult.error?.message}`
      );
      return;
    }

    const players = new Map((playerResult.data ?? []).map((p) => [p.id, p]));
    const hostelMap = new Map((hostelResult.data ?? []).map((h) => [h.id, h]));

    const rows = (data ?? []).map((a) => {
      const p = players.get(a.player_id);
      const h = hostelMap.get(a.hostel_id);

      return {
        "Participant": p?.player_name ?? "Unknown",
        "College": p?.college ?? "",
        "Sport": p?.sports ?? "",
        "Gender": p?.gender ?? "",
        "Role": p?.role ?? "",
        "Phone": p?.phone ?? "",
        "Hostel": h?.name ?? "Unknown",
        "Hostel Code": h?.code ?? "",
        "Start Date": a.start_date,
        "Nights": a.duration_days,
        "Expected Checkout": a.expected_checkout,
        "Checked In": a.checked_in ? "Yes" : "No",
        "Security Deposit": a.security_deposit ?? 0,
      };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      "Allocations"
    );
    XLSX.writeFile(workbook, "SURGE26_Accommodation_Allocations.xlsx");
    setMessage(`Exported ${rows.length} active allocation(s) to Excel.`);
  }

  const nights = Number(duration);
  const capacityRows: Occupancy[] = hostels.map((h) => {
    const occupied = getOccupancy(h.id, startDate);
    return {
      hostelId: h.id,
      occupied,
      remaining: Math.max(0, h.capacity - occupied),
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="text-sm text-cyan-400 hover:underline">
          ← Dashboard
        </a>

        <h1 className="mt-6 text-3xl font-bold">SURGE26 Participant Check-in</h1>
        <p className="mt-2 text-slate-400">
          Search participants, allocate accommodation, and save confirmed bookings.
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-950 p-4 text-red-200">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-5 rounded-lg bg-slate-900 p-4 text-cyan-200">
            {message}
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Find existing participant</h2>
          <input
            value={search}
            onChange={(e) => void searchPlayers(e.target.value)}
            placeholder="Search by participant name..."
            className={fieldClass}
          />

          {loading && <p className="mt-3 text-slate-400">Searching...</p>}

          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void selectPlayer(p)}
              className="mt-2 block w-full rounded-lg border border-slate-700 p-3 text-left hover:bg-slate-800"
            >
              <strong>{p.player_name}</strong>
              <span className="block text-sm text-slate-400">
                {p.college ?? "College not recorded"} · {p.sports ?? "Sport not recorded"}
              </span>
            </button>
          ))}
        </section>

        <form
          onSubmit={saveAllocation}
          className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5"
        >
          <h2 className="text-xl font-semibold">
            {player ? "Participant details" : "Register new participant"}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Full name *
              <input
                required
                value={form.player_name}
                onChange={(e) => setForm({ ...form, player_name: e.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="text-sm text-slate-300">
              College
              <input
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="text-sm text-slate-300">
              Sport
              <input
                value={form.sports}
                onChange={(e) => setForm({ ...form, sports: e.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="text-sm text-slate-300">
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="text-sm text-slate-300">
              Gender *
              <select
                required
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className={fieldClass}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Role *
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={fieldClass}
              >
                <option>Player</option>
                <option>Alumni</option>
                <option>Coach</option>
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
                onChange={(e) => setForm({ ...form, security_deposit: e.target.value })}
                className={fieldClass}
              />
            </label>

            <label className="text-sm text-slate-300">
              Check-in date *
              <input
                type="date"
                required
                min={FIRST_DATE}
                max="2026-10-31"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setProposedHostel("");
                  setHostel("");
                }}
                className={fieldClass}
              />
            </label>

            <label className="text-sm text-slate-300">
              Duration *
              <select
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setProposedHostel("");
                  setHostel("");
                }}
                className={fieldClass}
              >
                <option value="1">1 night</option>
                <option value="2">2 nights</option>
                <option value="3">3 nights</option>
              </select>
            </label>

            <div className="rounded-lg bg-slate-950 p-3 text-sm text-slate-300">
              Expected checkout:{" "}
              <strong>{addDays(startDate, nights)}</strong>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <h3 className="text-lg font-semibold">Hostel allocation</h3>
            <p className="mt-1 text-sm text-slate-400">
              First allocate, review the suggested hostel, then save.
            </p>

            <label className="mt-4 block text-sm text-slate-300">
              Proposed / selected hostel
              <select
                value={hostel}
                onChange={(e) => setHostel(e.target.value)}
                className={fieldClass}
                disabled={Boolean(savedAllocation)}
              >
                <option value="">
                  {hostels.length ? "Select or allocate a hostel" : "No hostels loaded"}
                </option>
                {hostels.map((h) => (
                  <option key={h.id} value={String(h.id)}>
                    {h.name}{h.code ? ` (${h.code})` : ""} · Capacity {h.capacity}
                  </option>
                ))}
              </select>
            </label>

            {proposedHostel && (
              <p className="mt-2 text-sm text-emerald-300">
                Suggested: {hostels.find((h) => String(h.id) === proposedHostel)?.name}.
                You can change the selection before saving.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving || Boolean(savedAllocation)}
                onClick={allocateHostel}
                className="rounded-lg bg-indigo-500 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                Allocate Hostel
              </button>

              <button
                type="submit"
                disabled={saving || Boolean(savedAllocation) || !proposedHostel || !hostel}
                className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Allocation"}
              </button>

              {savedAllocation && !savedAllocation.checked_in && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void checkIn()}
                  className="rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
                >
                  Check in participant
                </button>
              )}
            </div>
          </div>
        </form>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Hostel capacity</h2>
              <p className="mt-1 text-sm text-slate-400">
                Occupancy for the night of {startDate}. Refresh after allocations or checkouts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadHostels();
                void loadAllocations();
              }}
              className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800"
            >
              Refresh capacity
            </button>
          </div>

          {hostels.length === 0 && (
            <p className="mt-4 text-amber-300">
              No hostels loaded. Check Supabase access and the hostels table.
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-300">
                <tr>
                  <th className="p-3">Hostel</th>
                  <th className="p-3">Total beds</th>
                  <th className="p-3">Occupied</th>
                  <th className="p-3">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {capacityRows.map((row) => {
                  const h = hostels.find((x) => x.id === row.hostelId)!;
                  return (
                    <tr key={h.id} className="border-t border-slate-800">
                      <td className="p-3">{h.name}</td>
                      <td className="p-3">{h.capacity}</td>
                      <td className="p-3">{row.occupied}</td>
                      <td className="p-3 font-semibold text-emerald-300">
                        {row.remaining}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Excel export</h2>
          <p className="mt-2 text-sm text-slate-400">
            Export saved active accommodation allocations.
          </p>
          <button
            type="button"
            onClick={() => void exportExcel()}
            className="mt-4 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950"
          >
            Export allocations to Excel
          </button>
          <p className="mt-4 text-sm text-slate-400">
            <a href="/allocations" className="text-cyan-400 hover:underline">
              View currently allocated people →
            </a>
            {" · "}
            <a href="/checkout" className="text-cyan-400 hover:underline">
              Checkout page →
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
