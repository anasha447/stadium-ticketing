"use client";

import Link from "next/link";
import { countdown, type CountdownTone } from "@/lib/booking/countdown";
import { type ChosenSeat, MAX_SEATS, seatIdOf } from "@/lib/booking/selection";
import { parseSeatId } from "@/lib/domain/seat-id";
import type { Block, Currency, Hold } from "@/lib/domain/types";
import { formatMoney, TIER_NAME, TIER_SWATCH } from "@/lib/format";

// "Your seats": the seats the Fan has chosen, then the Hold on them with its
// countdown and Quote. Every price shown after the Hold comes from the
// Quote; before it, only each seat's base price is shown.

const ACTION =
  "inline-flex h-12 w-full items-center justify-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600 disabled:bg-night-800 disabled:text-flood-500";
const QUIET =
  "h-11 rounded-control border border-night-700 px-4 text-sm font-semibold transition-colors duration-fast hover:bg-night-800 disabled:text-flood-500";
const SMALL = "text-sm text-flood-300 underline-offset-4 hover:text-flood-50 hover:underline";

const TONE: Record<CountdownTone, string> = {
  calm: "text-flood-50",
  warn: "text-warn",
  danger: "text-danger",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function YourSeats({
  blocks,
  currency,
  chosen,
  hold,
  now,
  busy,
  notice,
  checkoutHref,
  shown,
  onClose,
  onView,
  onRemove,
  onHold,
  onRelease,
  onStartAgain,
}: {
  blocks: Block[];
  currency: Currency;
  chosen: ChosenSeat[];
  hold: Hold | null;
  /** The clock, for the countdown. */
  now: number;
  /** True while a Hold is being made or released. */
  busy: boolean;
  /** Something the Fan needs to know: a seat was taken, the limit was reached. */
  notice: string | null;
  checkoutHref: string | null;
  /** On a phone the drawer is closed until asked for. On wider screens it is always shown. */
  shown: boolean;
  onClose: () => void;
  onView: (seat: ChosenSeat) => void;
  onRemove: (seat: ChosenSeat) => void;
  onHold: () => void;
  onRelease: () => void;
  /** Clears a Hold that has run out. */
  onStartAgain: () => void;
}) {
  const left = hold ? countdown(hold.expiresAt, now) : null;
  const tierOf = (blockId: string) => blocks.find((b) => b.id === blockId)!;

  return (
    <section
      aria-label="Your seats"
      className={`glass absolute inset-x-4 bottom-4 z-10 max-h-[80dvh] flex-col gap-4 overflow-y-auto px-4 py-4 sm:inset-x-auto sm:bottom-auto sm:right-8 sm:top-4 sm:z-auto sm:flex sm:max-h-[calc(100%-17rem)] sm:w-80 ${
        shown ? "flex" : "hidden"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display text-2xl">Your seats</h2>
        <p className="data text-sm text-flood-300">
          {hold ? hold.seatIds.length : chosen.length} of {MAX_SEATS}
        </p>
        <button type="button" className={`${SMALL} sm:hidden`} onClick={onClose}>
          Close
        </button>
      </div>

      {notice && (
        <p role="alert" className="rounded-control border border-warn px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {/* Chosen, not yet held. */}
      {!hold && (
        <>
          <ul className="flex flex-col divide-y divide-night-700">
            {chosen.map((seat) => {
              const block = tierOf(seat.blockId);
              return (
                <li key={seatIdOf(seat)} className="flex flex-col gap-1 py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">
                      Block {seat.blockId}, row {pad(seat.row)}, seat {pad(seat.seat)}
                    </p>
                    <p className="data">{formatMoney(block.basePrice, currency)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm text-flood-300">
                      <span className={`size-3 ${TIER_SWATCH[block.tier]}`} aria-hidden />
                      {TIER_NAME[block.tier]}
                    </p>
                    <p className="flex gap-4">
                      <button type="button" className={SMALL} onClick={() => onView(seat)}>
                        View from seat
                      </button>
                      <button type="button" className={SMALL} onClick={() => onRemove(seat)}>
                        Remove
                      </button>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className={ACTION} onClick={onHold} disabled={busy}>
            {busy ? "Holding" : `Hold ${chosen.length} ${chosen.length === 1 ? "seat" : "seats"}`}
          </button>
          <p className="text-xs text-flood-500">
            Seats together in one Row cost less. You see the exact price as soon
            as you hold them, and it will not change after that.
          </p>
        </>
      )}

      {/* Held: the countdown and the Quote. */}
      {hold && left && !left.expired && (
        <>
          <div>
            <p className="text-sm text-flood-300">Held for you for</p>
            <p className={`data text-5xl ${TONE[left.tone]}`} role="timer">
              {left.text}
            </p>
          </div>

          <ul className="flex flex-col divide-y divide-night-700 border-y border-night-700">
            {hold.quote.lines.map((line) => {
              const seat = parseSeatId(line.seatId)!;
              return (
                <li key={line.seatId} className="flex items-baseline justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm">
                      Block {seat.blockId}, row {pad(seat.row)}, seat {pad(seat.seat)}
                    </p>
                    <p className="text-xs text-flood-300">
                      {TIER_NAME[line.tier]}
                      {line.discountPercent > 0 && (
                        <>
                          , {line.discountPercent}% off{" "}
                          <span className="data">{formatMoney(line.basePrice, currency)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="data">{formatMoney(line.price, hold.quote.currency)}</p>
                </li>
              );
            })}
          </ul>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">Total</p>
            <p className="data text-2xl">{formatMoney(hold.quote.total, hold.quote.currency)}</p>
          </div>

          {checkoutHref && (
            <Link href={checkoutHref} className={ACTION}>
              Continue to checkout
            </Link>
          )}
          <button type="button" className={QUIET} onClick={onRelease} disabled={busy}>
            Release seats
          </button>
        </>
      )}

      {hold && left?.expired && (
        <>
          <p>Your Hold ran out, so these seats are free again.</p>
          <button type="button" className={QUIET} onClick={onStartAgain}>
            Choose again
          </button>
        </>
      )}
    </section>
  );
}
