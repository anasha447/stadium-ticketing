import { cacheLife } from "next/cache";
import { api, isProblem } from "@/lib/api";
import type { Match, Occupancy, SeatMap } from "@/lib/domain/types";

// Reads for server components. Every Fan sees the same answer, so each one is
// cached on the server: when the crowd arrives, it hits this cache and not
// the gateway. Anything that belongs to one Fan is read in the browser.

export async function getMatches(): Promise<Match[]> {
  "use cache";
  cacheLife("minutes");
  return api.listMatches();
}

/** `null` when there is no such Match. */
export async function getMatch(matchId: number): Promise<Match | null> {
  "use cache";
  cacheLife("minutes");
  try {
    return await api.getMatch(matchId);
  } catch (error) {
    if (isProblem(error) && error.status === 404) return null;
    throw error;
  }
}

/** The layout never changes once a Match is on sale. */
export async function getSeatMap(matchId: number): Promise<SeatMap> {
  "use cache";
  cacheLife("days");
  return api.getSeatMap(matchId);
}

/**
 * Seats left. Refreshed in the background every 10 seconds, so the number on
 * the page is close to live while the crowd is still served from the cache.
 *
 * `expire` stays at 5 minutes on purpose: anything shorter makes Next treat
 * the read as uncacheable at build time, and the build then reports a cache
 * miss for the home page.
 */
export async function getOccupancy(matchId: number): Promise<Occupancy> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 10, expire: 300 });
  return api.getOccupancy(matchId);
}
