"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { countdown } from "@/lib/booking/countdown";
import type { Hold } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";
import { useNow } from "@/lib/hooks/use-now";

// Stands where the checkout will be (TKT-F303). It already shows what the
// checkout must never lose sight of: the Hold, its total and its time left.

const QUIET =
  "inline-flex h-12 items-center rounded-control border border-night-700 px-6 font-semibold transition-colors duration-fast hover:bg-night-800";

export function CheckoutHolding({ matchId, holdId }: { matchId: number; holdId: string }) {
  const now = useNow();
  const [hold, setHold] = useState<Hold | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getHold(matchId, holdId)
      .then((found) => {
        if (!cancelled) setHold(found);
      })
      .catch(() => {
        if (!cancelled) setGone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, holdId]);

  const left = hold ? countdown(hold.expiresAt, now) : null;
  const over = gone || left?.expired;

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-16 sm:px-12">
      <h1 className="display text-[clamp(2.25rem,8vw,5.5rem)]">Checkout</h1>

      {!hold && !gone && <p className="text-flood-300">Finding your Hold</p>}

      {over && (
        <p className="max-w-md text-flood-300">
          This Hold has run out, so the seats are free again. Go back to the
          stadium to choose seats.
        </p>
      )}

      {hold && left && !left.expired && (
        <>
          <p className="max-w-md text-flood-300">
            Paying is the next thing we are building. Your{" "}
            {hold.seatIds.length === 1 ? "seat is" : `${hold.seatIds.length} seats are`} held
            until the time runs out.
          </p>
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            <div>
              <dt className="text-sm text-flood-300">Time left</dt>
              <dd
                role="timer"
                className={`data text-5xl ${
                  left.tone === "danger" ? "text-danger" : left.tone === "warn" ? "text-warn" : ""
                }`}
              >
                {left.text}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-flood-300">Total</dt>
              <dd className="data text-5xl">
                {formatMoney(hold.quote.total, hold.quote.currency)}
              </dd>
            </div>
          </dl>
        </>
      )}

      <div>
        <Link href={`/matches/${matchId}/seats`} className={QUIET}>
          Back to the stadium
        </Link>
      </div>
    </main>
  );
}
