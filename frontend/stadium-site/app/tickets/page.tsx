import type { Metadata } from "next";
import { MyTickets } from "@/components/tickets/my-tickets";

export const metadata: Metadata = { title: "My Tickets" };

// Tickets belong to one Fan, so the page is a shell and the list is read in the browser.
export default function TicketsPage() {
  return <MyTickets />;
}
