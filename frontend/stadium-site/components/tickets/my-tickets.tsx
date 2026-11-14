"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, resetMockData, usingMock } from "@/lib/api";
import type { Match, Ticket } from "@/lib/domain/types";
import { formatDay } from "@/lib/format";
import { TicketCard } from "./ticket-card";

// Every Ticket this Fan has, grouped by Match, soonest Match first. Tickets
// belong to one Fan, so they are read in the browser, never prebuilt.

const ACTION =
  "inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600";
const QUIET =
  "inline-flex h-11 items-center rounded-control border border-night-700 px-4 text-sm font-semibold transition-colors duration-fast hover:bg-night-800";

export function MyTickets() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [failed, setFailed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listMyTickets(), api.listMatches()])
      .then(([mine, all]) => {
        if (cancelled) return;
        setTickets(mine);
        setMatches(all);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    if (!tickets) return [];
    const byMatch = new Map<number, Ticket[]>();
    for (const ticket of tickets) {
      byMatch.set(ticket.matchId, [...(byMatch.get(ticket.matchId) ?? []), ticket]);
    }
    return [...byMatch.entries()]
      .map(([matchId, list]) => ({
        match: matches.find((m) => m.id === matchId),
        tickets: [...list].sort((a, b) => a.seatId.localeCompare(b.seatId)),
      }))
      .sort((a, b) => (a.match?.kickoffAt ?? "").localeCompare(b.match?.kickoffAt ?? ""));
  }, [tickets, matches]);

  const reset = () => {
    resetMockData();
    router.push("/");
  };

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-12 sm:px-12">
      <h1 className="display text-[clamp(2.25rem,8vw,5.5rem)]">My Tickets</h1>

      {failed && (
        <p className="text-flood-300">Your Tickets could not be loaded just now. Reload to try again.</p>
      )}
      {!tickets && !failed && (
        <p className="text-flood-300" role="status">
          Finding your Tickets
        </p>
      )}

      {tickets?.length === 0 && (
        <>
          <p className="max-w-md text-flood-300">
            You have no Tickets yet. Pick a Match, choose your seats, and they will
            show up here.
          </p>
          <div>
            <Link href="/" className={ACTION}>
              See the Matches
            </Link>
          </div>
        </>
      )}

      {groups.map(({ match, tickets: list }) => (
        <section key={list[0].matchId} className="flex flex-col gap-4" aria-label={match ? `${match.home.name} v ${match.away.name}` : "Match"}>
          {match && (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="display text-3xl">
                {match.home.name} v {match.away.name}
              </h2>
              <p className="flex gap-6 text-sm text-flood-300">
                {formatDay(match.kickoffAt)}
                <Link
                  href={`/matches/${match.id}/seats`}
                  className="underline-offset-4 hover:text-flood-50 hover:underline"
                >
                  See your seats in the stadium
                </Link>
              </p>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {list.map((ticket) => (
              <TicketCard key={ticket.ticketId} ticket={ticket} match={match} />
            ))}
          </div>
        </section>
      ))}

      {usingMock && tickets && (
        <section className="mt-8 flex flex-col items-start gap-3 border-t border-night-700 pt-6">
          <p className="max-w-md text-sm text-flood-300">
            Demo data: your place in the Waiting Room, your Holds, Orders and
            Tickets live only in this browser.
          </p>
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">Forget all of it and start again?</p>
              <button type="button" className={QUIET} onClick={reset}>
                Yes, reset the demo
              </button>
              <button type="button" className={QUIET} onClick={() => setConfirmReset(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className={QUIET} onClick={() => setConfirmReset(true)}>
              Reset the demo
            </button>
          )}
        </section>
      )}
    </main>
  );
}
