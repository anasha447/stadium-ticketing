// Shown at once when a Fan opens a Match, while the page itself streams in.
// It keeps the page's outline so nothing jumps when the content lands.
export default function Loading() {
  return (
    <main
      className="flex flex-1 flex-col gap-6 px-6 pb-20 pt-8 sm:px-12"
      aria-busy="true"
      aria-label="Loading the Match"
    >
      <div className="h-6 w-56 bg-night-900" />
      <div className="h-[clamp(5.5rem,20vw,15rem)] max-w-3xl bg-night-900" />
      <div className="h-7 w-64 bg-night-900" />
      <div className="h-12 w-44 rounded-control bg-night-900" />
    </main>
  );
}
