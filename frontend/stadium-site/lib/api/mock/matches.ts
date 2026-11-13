import type { Match, Team } from "@/lib/domain/types";

// Demo fixtures. `soldShare` is how much of the stadium was sold before the
// Fan arrived; it is mock-only and never leaves this folder.

const barcelona: Team = { id: "fcb", name: "FC Barcelona", shortName: "Barcelona" };
const espanyol: Team = { id: "esp", name: "RCD Espanyol", shortName: "Espanyol" };
const girona: Team = { id: "gir", name: "Girona FC", shortName: "Girona" };
const athletic: Team = { id: "ath", name: "Athletic Club", shortName: "Athletic" };

const VENUE = "Spotify Camp Nou";
const COMPETITION = "La Liga";

export interface MockMatch extends Match {
  soldShare: number;
}

export const MATCHES: MockMatch[] = [
  {
    id: 1,
    home: barcelona,
    away: espanyol,
    competition: COMPETITION,
    venue: VENUE,
    kickoffAt: "2026-12-19T20:00:00Z",
    bookingOpensAt: "2026-11-10T09:00:00Z",
    status: "BOOKING_OPEN",
    soldShare: 0.5,
  },
  {
    id: 2,
    home: barcelona,
    away: girona,
    competition: COMPETITION,
    venue: VENUE,
    kickoffAt: "2027-01-16T17:30:00Z",
    bookingOpensAt: "2026-12-14T09:00:00Z",
    status: "SCHEDULED",
    soldShare: 0,
  },
  {
    id: 3,
    home: barcelona,
    away: athletic,
    competition: COMPETITION,
    venue: VENUE,
    kickoffAt: "2027-02-06T20:00:00Z",
    bookingOpensAt: "2027-01-04T09:00:00Z",
    status: "SCHEDULED",
    soldShare: 0,
  },
];

export function findMatch(matchId: number): MockMatch | undefined {
  return MATCHES.find((match) => match.id === matchId);
}

/** The public shape, without the mock-only field. */
export function toMatch(match: MockMatch): Match {
  const publicMatch: Partial<MockMatch> = { ...match };
  delete publicMatch.soldShare;
  return publicMatch as Match;
}
