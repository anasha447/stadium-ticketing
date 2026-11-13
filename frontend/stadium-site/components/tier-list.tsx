import type { Tier } from "@/lib/domain/types";
import { formatCount, formatMoney, TIER_NAME, TIER_ORDER } from "@/lib/format";
import { getOccupancy, getSeatMap } from "@/lib/queries";

// The four Tiers with their price and seats left. The swatch is the colour
// the Tier has on the seat map.

const SWATCH: Record<Tier, string> = {
  CLUB_PREMIUM: "bg-tier-premium",
  CATEGORY_1: "bg-tier-1",
  CATEGORY_2: "bg-tier-2",
  CATEGORY_3: "bg-tier-3",
};

const WHERE: Record<Tier, string> = {
  CLUB_PREMIUM: "Club Level, along the sides",
  CATEGORY_1: "Lower Level along the sides, Club Level corners",
  CATEGORY_2: "Upper Level along the sides, Lower corners, Club Level ends",
  CATEGORY_3: "Behind the goals, Lower and Upper Level",
};

export async function TierList({ matchId }: { matchId: number }) {
  const [seatMap, occupancy] = await Promise.all([
    getSeatMap(matchId),
    getOccupancy(matchId),
  ]);

  const rows = TIER_ORDER.map((tier) => {
    const blocks = seatMap.blocks.filter((block) => block.tier === tier);
    const available = blocks.reduce(
      (sum, block) => sum + occupancy.blocks[block.id].available,
      0,
    );
    return { tier, price: blocks[0].basePrice, available };
  });

  return (
    <ul className="border-t border-night-700">
      {rows.map(({ tier, price, available }) => (
        <li
          key={tier}
          className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-night-700 py-4"
        >
          <span className={`size-3 self-center ${SWATCH[tier]}`} aria-hidden />
          <span className="font-semibold">{TIER_NAME[tier]}</span>
          <span className="data text-lg">
            {formatMoney(price, seatMap.currency)}
          </span>
          <span className="col-start-2 text-sm text-flood-300">{WHERE[tier]}</span>
          <span className="data text-sm text-flood-300">
            {formatCount(available)} left
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TierListFallback() {
  return <div className="h-72 border-y border-night-700 bg-night-900" aria-hidden />;
}
