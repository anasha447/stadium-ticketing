import { BlockStrip } from "@/components/block-strip";
import { formatCount } from "@/lib/format";
import { getOccupancy, getSeatMap } from "@/lib/queries";

// Seats left for a Match, with the strip. It reads live-ish numbers, so pages
// render it inside <Suspense> and show SeatsLeftFallback until it arrives.

export async function SeatsLeft({
  matchId,
  labelled = false,
}: {
  matchId: number;
  labelled?: boolean;
}) {
  const [seatMap, occupancy] = await Promise.all([
    getSeatMap(matchId),
    getOccupancy(matchId),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-flood-300">
        <span className="data text-2xl text-flood-50">
          {formatCount(occupancy.available)}
        </span>{" "}
        of {formatCount(seatMap.seatCount)} seats left
      </p>
      <BlockStrip
        blocks={seatMap.blocks}
        counts={occupancy.blocks}
        labelled={labelled}
      />
    </div>
  );
}

export function SeatsLeftFallback() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <p className="text-flood-500">
        <span className="data text-2xl">——</span> seats left
      </p>
      <div className="h-[4.5rem] bg-night-900" />
    </div>
  );
}
