import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Choose your seats" };

// Stands in for the 3D stadium, which arrives with TKT-F201 to F203.
export default function SeatsPage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-16 sm:px-12">
      <h1 className="display text-[clamp(2.25rem,8vw,5.5rem)]">
        The stadium is being built
      </h1>
      <p className="max-w-md text-flood-300">
        This is where you will fly around the stadium, open a Block and sit in
        a seat to see the pitch from it. It is the next thing we are building.
      </p>
      <div>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-control border border-night-700 px-6 font-semibold transition-colors duration-fast hover:bg-night-800"
        >
          Back to the Matches
        </Link>
      </div>
    </main>
  );
}
