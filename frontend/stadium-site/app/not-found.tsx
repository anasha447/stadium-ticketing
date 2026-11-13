import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-16 sm:px-12">
      <h1 className="display text-[clamp(2.25rem,8vw,5.5rem)]">
        Nothing at this address
      </h1>
      <p className="max-w-md text-flood-300">
        The page or Match you asked for does not exist. It may have been moved,
        or the link may be wrong.
      </p>
      <div>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600"
        >
          See the Matches
        </Link>
      </div>
    </main>
  );
}
