import { useMemo } from "react";
import { parseSeatId } from "@/lib/domain/seat-id";
import type { Currency, Match, Ticket } from "@/lib/domain/types";
import { formatDay, formatMoney, formatTime, TIER_NAME, TIER_SWATCH } from "@/lib/format";
import { PATTERN_SIZE, ticketPattern } from "@/lib/tickets/pattern";

// One Ticket: the Match, the seat, its price, and a square code that only
// looks like one (see lib/tickets/pattern.ts).

/** Prices are in euros everywhere on this site; a Ticket does not repeat it. */
const CURRENCY: Currency = "EUR";

const pad = (n: number) => String(n).padStart(2, "0");

export function TicketCard({ ticket, match }: { ticket: Ticket; match?: Match }) {
  const seat = parseSeatId(ticket.seatId);
  const cells = useMemo(() => ticketPattern(ticket.ticketId), [ticket.ticketId]);

  return (
    <article
      aria-label={`Ticket for ${ticket.seatId}`}
      className="flex flex-col gap-5 rounded-panel bg-night-900 p-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-4">
        {match && (
          <div>
            <p className="display text-2xl">
              {match.home.shortName} v {match.away.shortName}
            </p>
            <p className="text-sm text-flood-300">
              {formatDay(match.kickoffAt)}, {formatTime(match.kickoffAt)} · {match.venue}
            </p>
          </div>
        )}
        {seat && (
          <dl className="grid grid-cols-3 gap-x-6 gap-y-1">
            <div>
              <dt className="text-xs text-flood-300">Block</dt>
              <dd className="data text-2xl">{seat.blockId}</dd>
            </div>
            <div>
              <dt className="text-xs text-flood-300">Row</dt>
              <dd className="data text-2xl">{pad(seat.row)}</dd>
            </div>
            <div>
              <dt className="text-xs text-flood-300">Seat</dt>
              <dd className="data text-2xl">{pad(seat.seat)}</dd>
            </div>
          </dl>
        )}
        <p className="flex items-center gap-2 text-sm text-flood-300">
          <span className={`size-3 ${TIER_SWATCH[ticket.tier]}`} aria-hidden />
          {TIER_NAME[ticket.tier]} ·{" "}
          <span className="data text-flood-50">{formatMoney(ticket.price, CURRENCY)}</span>
        </p>
      </div>

      <figure className="flex flex-col items-start gap-2 sm:items-center">
        <svg
          viewBox={`-2 -2 ${PATTERN_SIZE + 4} ${PATTERN_SIZE + 4}`}
          className="size-32 rounded-control bg-flood-50"
          shapeRendering="crispEdges"
          aria-hidden
        >
          {cells.flatMap((row, r) =>
            row.map((dark, c) =>
              dark ? (
                <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} className="fill-night-950" />
              ) : null,
            ),
          )}
        </svg>
        <figcaption className="max-w-32 text-xs text-flood-500">
          For show only. It cannot be scanned.
        </figcaption>
      </figure>
    </article>
  );
}
