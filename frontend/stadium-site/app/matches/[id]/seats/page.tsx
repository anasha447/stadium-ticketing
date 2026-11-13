import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StadiumLoading, StadiumView } from "@/components/stadium/stadium-view";
import type { Level } from "@/lib/domain/types";
import { getMatch, getMatches, getSeatMap } from "@/lib/queries";

type Props = PageProps<"/matches/[id]/seats">;

export const metadata: Metadata = { title: "Choose your seats" };

export async function generateStaticParams() {
  const matches = await getMatches();
  return matches.map((match) => ({ id: String(match.id) }));
}

// The stadium fills the screen under the header; panels float over it.
export default function SeatsPage({ params }: Props) {
  return (
    <main className="relative min-h-[calc(100dvh-4.25rem)] flex-1">
      <div className="absolute inset-0">
        <Suspense fallback={<StadiumLoading />}>
          <Stadium params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Stadium({ params }: { params: Props["params"] }) {
  const { id } = await params;
  const matchId = Number(id);
  const match = Number.isInteger(matchId) ? await getMatch(matchId) : null;
  if (!match) notFound();

  // The terraces are built with one step per Row, so the 3D model needs to
  // know how many Rows each Level has. That comes from the Seat Map.
  const seatMap = await getSeatMap(matchId);
  const rows = {} as Record<Level, number>;
  for (const block of seatMap.blocks) rows[block.level] = block.rowSeats.length;

  return (
    <>
      <StadiumView rows={rows} />
      <div className="glass pointer-events-none absolute left-4 top-4 max-w-[min(22rem,calc(100%-2rem))] px-4 py-3 sm:left-8">
        <p className="display text-2xl">
          {match.home.shortName} v {match.away.shortName}
        </p>
        <p className="text-sm text-flood-300">
          Drag to spin the stadium. Scroll or pinch to zoom.
        </p>
      </div>
    </>
  );
}
