import { SIDES } from "@/lib/domain/stadium";
import type { Block, Level, SeatCounts, Side } from "@/lib/domain/types";
import { formatCount } from "@/lib/format";

// The stadium unrolled: one cell per Block, one band per Level, read left to
// right around the bowl. The brighter a cell, the more seats are left in it.

const BANDS: { level: Level; name: string; height: string }[] = [
  { level: "UPPER", name: "Upper", height: "h-7" },
  { level: "CLUB", name: "Club", height: "h-3" },
  { level: "LOWER", name: "Lower", height: "h-6" },
];

// `detail` is dropped on narrow screens, where a goal end is too short for it.
const SIDE_LABEL: Record<Side, { name: string; detail: string }> = {
  WEST: { name: "West", detail: "side" },
  NORTH: { name: "North", detail: "goal" },
  EAST: { name: "East", detail: "side" },
  SOUTH: { name: "South", detail: "goal" },
};

const GRID = "grid grid-cols-[repeat(40,minmax(0,1fr))] gap-px";

interface BlockStripProps {
  blocks: Block[];
  counts: Record<string, SeatCounts>;
  /** Show the Level and side names around the strip. */
  labelled?: boolean;
}

export function BlockStrip({ blocks, counts, labelled = false }: BlockStripProps) {
  const cell = (block: Block) => {
    const { available, held, sold } = counts[block.id];
    const share = available / (available + held + sold);
    return (
      <span
        key={block.id}
        title={`Block ${block.id}: ${formatCount(available)} seats left`}
        className="bg-flood-50"
        style={{ opacity: 0.1 + 0.9 * share }}
      />
    );
  };

  return (
    <div
      role="img"
      aria-label="Seats left in each Block, by Level, going around the stadium"
      className="flex flex-col gap-1"
    >
      {BANDS.map(({ level, name, height }) => (
        <div key={level} className="flex items-center gap-3">
          {labelled && (
            <span className="w-12 shrink-0 text-xs text-flood-500">{name}</span>
          )}
          <div className={`${GRID} ${height} flex-1`}>
            {blocks.filter((block) => block.level === level).map(cell)}
          </div>
        </div>
      ))}
      {labelled && (
        <div className="flex gap-3 pt-1">
          <span className="w-12 shrink-0" />
          <div className={`${GRID} flex-1 text-xs text-flood-500`}>
            {SIDES.map(({ side, blocks: span }) => (
              <span
                key={side}
                style={{ gridColumn: `span ${span}` }}
                className="truncate border-t border-night-700 pt-1"
              >
                {SIDE_LABEL[side].name}
                <span className="hidden sm:inline"> {SIDE_LABEL[side].detail}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
