import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-5 sm:px-12">
      <Link href="/" className="display text-2xl">
        Stadium Tickets
      </Link>
      <nav aria-label="Main">
        <Link
          href="/tickets"
          className="text-sm text-flood-300 transition-colors duration-fast hover:text-flood-50"
        >
          My Tickets
        </Link>
      </nav>
    </header>
  );
}
