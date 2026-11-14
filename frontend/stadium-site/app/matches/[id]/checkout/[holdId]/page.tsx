import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Checkout as CheckoutScreen } from "@/components/checkout/checkout";

type Props = PageProps<"/matches/[id]/checkout/[holdId]">;

export const metadata: Metadata = { title: "Checkout" };

// A Hold belongs to one Fan and lasts minutes, so nothing here is prebuilt:
// the page reads the route and hands over to the browser.
export default function CheckoutPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="flex-1" aria-busy="true" />}>
      <Checkout params={params} />
    </Suspense>
  );
}

async function Checkout({ params }: { params: Props["params"] }) {
  const { id, holdId } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId)) notFound();
  return <CheckoutScreen matchId={matchId} holdId={holdId} />;
}
