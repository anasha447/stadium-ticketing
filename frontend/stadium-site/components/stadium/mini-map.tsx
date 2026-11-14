"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Block, Tier } from "@/lib/domain/types";
import { PITCH, seatPlace } from "@/lib/stadium/layout";
import { blockOutline, MAP_BOUNDS } from "@/lib/stadium/minimap";
import type { View } from "@/lib/stadium/view";
import type { Heading } from "./camera-rig";

// The stadium from straight above, north at the top. Every Block is a
// shape you can press to fly there. Once you are seated it marks your seat
// and the way you are looking.

const TIER_FILL: Record<Tier, string> = {
  CLUB_PREMIUM: "fill-tier-premium",
  CATEGORY_1: "fill-tier-1",
  CATEGORY_2: "fill-tier-2",
  CATEGORY_3: "fill-tier-3",
};

const { halfWidth, halfHeight } = MAP_BOUNDS;

export function MiniMap({
  blocks,
  view,
  litBlockId,
  shownTier,
  heading,
  onOpenBlock,
  onHoverBlock,
}: {
  blocks: Block[];
  view: View;
  litBlockId: string | null;
  shownTier: Tier | null;
  heading: { current: Heading };
  onOpenBlock: (blockId: string) => void;
  onHoverBlock: (blockId: string | null) => void;
}) {
  const outlines = useMemo(
    () => blocks.map((block) => ({ block, path: blockOutline(block) })),
    [blocks],
  );
  const openId = view.kind === "stadium" ? null : view.blockId;

  const seat = useMemo(() => {
    if (view.kind !== "seat") return null;
    const block = blocks.find((b) => b.id === view.blockId);
    return block ? seatPlace(block, view.row, view.seat) : null;
  }, [view, blocks]);

  // The look direction changes every frame while the Fan drags, so it is
  // written straight to the SVG and never goes through React.
  const cone = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!seat) return;
    let frame = 0;
    const turn = () => {
      const { x, z } = heading.current;
      const degrees = (Math.atan2(z, x) * 180) / Math.PI;
      cone.current?.setAttribute("transform", `translate(${seat.x} ${seat.z}) rotate(${degrees})`);
      frame = requestAnimationFrame(turn);
    };
    frame = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(frame);
  }, [seat, heading]);

  return (
    <svg
      viewBox={`${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`}
      className="h-full w-full"
      role="group"
      aria-label="Map of the stadium from above. Press a Block to go to it."
      onPointerLeave={() => onHoverBlock(null)}
    >
      <rect
        x={-PITCH.width / 2}
        y={-PITCH.length / 2}
        width={PITCH.width}
        height={PITCH.length}
        className="fill-scene-turf-dark"
      />

      {outlines.map(({ block, path }) => {
        const isOpen = block.id === openId;
        const dimmed = shownTier !== null && block.tier !== shownTier;
        const lit = block.id === litBlockId;
        return (
          <path
            key={block.id}
            d={path}
            className={`cursor-pointer transition-opacity duration-fast ${
              isOpen ? "fill-flood-50" : TIER_FILL[block.tier]
            }`}
            opacity={isOpen || lit ? 1 : dimmed ? 0.12 : 0.55}
            onClick={() => onOpenBlock(block.id)}
            onPointerEnter={() => onHoverBlock(block.id)}
          >
            <title>{`Block ${block.id}`}</title>
          </path>
        );
      })}

      {seat && (
        <>
          {/* A wedge for the field of view, turned to face where the Fan looks. */}
          <path
            ref={cone}
            d="M0 0 L46 -22 A51 51 0 0 1 46 22 Z"
            className="pointer-events-none fill-state-mine"
            opacity={0.35}
          />
          <circle cx={seat.x} cy={seat.z} r={5} className="pointer-events-none fill-state-mine" />
        </>
      )}
    </svg>
  );
}
