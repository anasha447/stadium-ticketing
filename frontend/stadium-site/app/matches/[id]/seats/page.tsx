import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StadiumExperience, StadiumLoading } from "@/components/stadium/stadium-experience";
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

  // The Seat Map tells the 3D model how many Rows and seats each Block has.
  const seatMap = await getSeatMap(matchId);

  return (
    <StadiumExperience
      matchId={matchId}
      title={`${match.home.shortName} v ${match.away.shortName}`}
      blocks={seatMap.blocks}
      currency={seatMap.currency}
    />
  );
}
