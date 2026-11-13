import type { Metadata } from "next";

export const metadata: Metadata = { title: "Design system" };

// A living reference of the tokens in globals.css, for review.
// Class names are written out in full so Tailwind can see them.

type Swatch = { name: string; className: string; note: string };

const groups: { title: string; rule: string; swatches: Swatch[] }[] = [
  {
    title: "Interface",
    rule: "Night and floodlight. Nothing in the chrome is saturated.",
    swatches: [
      { name: "night-950", className: "bg-night-950", note: "page, sky" },
      { name: "night-900", className: "bg-night-900", note: "solid surface" },
      { name: "night-800", className: "bg-night-800", note: "raised, inputs" },
      { name: "night-700", className: "bg-night-700", note: "borders" },
      { name: "flood-50", className: "bg-flood-50", note: "primary text" },
      { name: "flood-300", className: "bg-flood-300", note: "secondary text" },
      { name: "flood-500", className: "bg-flood-500", note: "hints" },
    ],
  },
  {
    title: "Action",
    rule: "One orange control per screen, and nothing else is orange.",
    swatches: [
      { name: "signal-400", className: "bg-signal-400", note: "hover" },
      { name: "signal-500", className: "bg-signal-500", note: "rest" },
      { name: "signal-600", className: "bg-signal-600", note: "pressed" },
    ],
  },
  {
    title: "Seats · mosaic",
    rule: "Stadium view. The real seat colours, with the marks in yellow.",
    swatches: [
      { name: "seat-blau", className: "bg-seat-blau", note: "blue seats" },
      { name: "seat-grana", className: "bg-seat-grana", note: "garnet seats" },
      { name: "seat-or", className: "bg-seat-or", note: "the marks" },
    ],
  },
  {
    title: "Seats · state",
    rule: "Block and Seat view. Available seats take their Tier colour.",
    swatches: [
      { name: "tier-premium", className: "bg-tier-premium", note: "Club Premium" },
      { name: "tier-1", className: "bg-tier-1", note: "Category 1" },
      { name: "tier-2", className: "bg-tier-2", note: "Category 2" },
      { name: "tier-3", className: "bg-tier-3", note: "Category 3" },
      { name: "state-held", className: "bg-state-held", note: "held, pulses" },
      { name: "state-sold", className: "bg-state-sold", note: "sold, with a fan" },
      { name: "state-mine", className: "bg-state-mine", note: "yours, outline" },
    ],
  },
  {
    title: "Messages",
    rule: "For messages only, never for seats.",
    swatches: [
      { name: "ok", className: "bg-ok", note: "success" },
      { name: "warn", className: "bg-warn", note: "under 60 seconds" },
      { name: "danger", className: "bg-danger", note: "under 15 seconds, errors" },
    ],
  },
];

export default function DesignPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-12 sm:px-12">
      <header className="flex flex-col gap-4">
        <h1 className="display text-[clamp(2.25rem,8vw,5.5rem)]">
          Design system
        </h1>
        <p className="max-w-xl text-flood-300">
          A night match under floodlights. The page is the sky, the stadium is
          the lit object, and the interface is thin glass over it.
        </p>
      </header>

      <section className="flex flex-col gap-10">
        <h2 className="display text-4xl">Colour</h2>
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-4">
            <div>
              <h3 className="font-semibold">{group.title}</h3>
              <p className="text-sm text-flood-300">{group.rule}</p>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {group.swatches.map((swatch) => (
                <li key={swatch.name} className="flex flex-col gap-2">
                  <div
                    className={`h-16 rounded-control border border-night-700 ${swatch.className}`}
                  />
                  <div>
                    <p className="data text-xs">{swatch.name}</p>
                    <p className="text-xs text-flood-500">{swatch.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-8">
        <h2 className="display text-4xl">Type</h2>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-flood-300">
            Display · Big Shoulders · fixtures, titles, Block numbers
          </p>
          <p className="display text-[clamp(2.25rem,9vw,5.5rem)]">
            Block 214 · Row 07
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-flood-300">
            Text · Geist · sentences, labels, buttons
          </p>
          <p className="max-w-xl text-lg">
            Your seats are held for eight minutes. The price on the Quote is the
            price you pay.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-flood-300">
            Data · Geist Mono, tabular · anything that changes while you look
          </p>
          <p className="data text-4xl">
            09:41 <span className="text-warn">00:52</span>{" "}
            <span className="text-danger">00:11</span>
          </p>
          <p className="data text-flood-300">214-R07-12 · €320.00</p>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="display text-4xl">Controls</h2>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="h-12 rounded-control bg-signal-500 px-6 font-semibold text-signal-ink transition-colors duration-fast hover:bg-signal-400 active:bg-signal-600"
          >
            Hold 3 seats
          </button>
          <button
            type="button"
            className="h-12 rounded-control border border-night-700 px-6 font-semibold transition-colors duration-fast hover:bg-night-800"
          >
            View from seat
          </button>
          <button
            type="button"
            disabled
            className="h-12 rounded-control bg-night-800 px-6 font-semibold text-flood-500"
          >
            Sold
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="display text-4xl">Glass</h2>
        <p className="max-w-xl text-sm text-flood-300">
          Only for panels floating over the 3D canvas. The stripes stand in for
          the stadium.
        </p>
        <div className="relative overflow-hidden rounded-panel bg-[repeating-linear-gradient(115deg,var(--color-seat-blau)_0_48px,var(--color-seat-grana)_48px_96px)] p-6 sm:p-10">
          <div className="glass flex max-w-sm flex-col gap-4 p-5">
            <div className="flex items-baseline justify-between">
              <p className="display text-3xl">Block 214</p>
              <p className="data text-sm text-flood-300">Category 1</p>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-flood-300">Row</dt>
                <dd className="data text-lg">07</dd>
              </div>
              <div>
                <dt className="text-flood-300">Seat</dt>
                <dd className="data text-lg">12</dd>
              </div>
              <div>
                <dt className="text-flood-300">Price</dt>
                <dd className="data text-lg">€320</dd>
              </div>
            </dl>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-flood-300">
              <li className="flex items-center gap-2">
                <span className="size-3 bg-tier-1" /> Available
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3 animate-pulse bg-state-held" /> Held
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3 bg-state-sold" /> Sold
              </li>
              <li className="flex items-center gap-2">
                <span className="size-3 bg-tier-1 outline-2 outline-offset-2 outline-state-mine" />{" "}
                Yours
              </li>
            </ul>
          </div>
        </div>
      </section>

    </main>
  );
}
