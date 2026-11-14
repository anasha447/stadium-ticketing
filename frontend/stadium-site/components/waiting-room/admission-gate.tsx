"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";

// Stands in front of the stadium. A Fan who has not been admitted is sent
// to the Waiting Room; one who has goes straight through. The gateway
// enforces the same rule on Holds, so this is a courtesy, not the lock.

export function AdmissionGate({
  matchId,
  children,
  waiting,
}: {
  matchId: number;
  children: ReactNode;
  /** Shown while the Fan's admission is being checked. */
  waiting: ReactNode;
}) {
  const router = useRouter();
  const [admitted, setAdmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getWaitingRoom(matchId)
      .then((status) => {
        if (cancelled) return;
        if (status.phase === "ADMITTED") setAdmitted(true);
        else router.replace(`/matches/${matchId}/waiting-room`);
      })
      // If the check itself fails, the Waiting Room can explain better than an empty stadium.
      .catch(() => {
        if (!cancelled) router.replace(`/matches/${matchId}/waiting-room`);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, router]);

  return admitted ? children : waiting;
}
