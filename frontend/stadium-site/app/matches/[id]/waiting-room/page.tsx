import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WaitingRoom } from "@/components/waiting-room/waiting-room";
import { getMatch, getMatches } from "@/lib/queries";

type Props = PageProps<"/matches/[id]/waiting-room">;

export const metadata: Metadata = { title: "Waiting Room" };

export async function generateStaticParams() {
  const matches = await getMatches();
  return matches.map((match) => ({ id: String(match.id) }));
}

export default function WaitingRoomPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="flex-1" aria-busy="true" />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Props["params"] }) {
  const { id } = await params;
  const matchId = Number(id);
  const match = Number.isInteger(matchId) ? await getMatch(matchId) : null;
  // There is no Waiting Room for a Match that is not on sale.
  if (!match || match.status !== "BOOKING_OPEN") notFound();

  return <WaitingRoom match={match} />;
}
