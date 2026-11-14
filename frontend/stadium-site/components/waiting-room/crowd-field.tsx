"use client";

import { useEffect, useRef } from "react";
import { COLOR } from "@/lib/design/tokens";
import {
  crowdPoint,
  dotForPosition,
  DOTS,
  drawOrder,
  type Point,
  QUEUE_COLUMNS,
  queuePoint,
} from "@/lib/waiting-room/field";

// The Waiting Room as a picture. Each dot stands for several Fans; the
// bright one is this Fan. Before the Draw the dots stand about as a crowd.
// At the Draw every dot moves at once into a queue, so it is plain that
// nobody kept the place they arrived in. Then the front of the queue goes
// in through the top and everyone behind moves up.

export type FieldPhase =
  | { kind: "crowd" }
  /** `position` counts down from `drawn` to 1 as Fans ahead are let in. */
  | { kind: "queue"; position: number; drawn: number; waiting: number }
  | { kind: "admitted" };

/** The dot that stands for this Fan. */
const FAN = 0;

/** How quickly a dot closes the distance to where it should be. Higher is snappier. */
const FOLLOW = 5;

interface Dot extends Point {
  /** 0 to 1. Dots that have gone in fade out. */
  alpha: number;
}

/** Where every dot should be, and how visible, for a phase. */
function targets(phase: FieldPhase, order: number[]): Dot[] {
  if (phase.kind === "crowd") {
    return Array.from({ length: DOTS }, (_, i) => ({ ...crowdPoint(i), alpha: 1 }));
  }
  // How many dots' worth of Fans have gone in since the Draw.
  const gone =
    phase.kind === "admitted"
      ? order[FAN]
      : dotForPosition(phase.drawn, phase.waiting) - dotForPosition(phase.position, phase.waiting);
  return order.map((place, i) => {
    const now = place - gone;
    if (i === FAN && phase.kind === "admitted") return { x: 0.5, y: 0.13, alpha: 1 };
    // Dots that have gone in rise through the top and fade.
    if (now < 0) return { x: queuePoint(place % QUEUE_COLUMNS).x, y: 0.08, alpha: 0 };
    return { ...queuePoint(now), alpha: 1 };
  });
}

export function CrowdField({
  phase,
  reducedMotion,
}: {
  phase: FieldPhase;
  reducedMotion: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  /** What the drawing loop should aim for. Updated when the phase changes. */
  const goal = useRef<{ dots: Dot[]; jump: boolean }>({ dots: [], jump: true });
  const order = useRef<number[] | null>(null);

  // Queue places are decided once, at the Draw, with this Fan's dot put where
  // their real place is.
  const drawn = phase.kind === "queue" ? phase.drawn : null;
  const waiting = phase.kind === "queue" ? phase.waiting : null;
  useEffect(() => {
    if (drawn === null || waiting === null || order.current) return;
    const shuffled = drawOrder(drawn);
    const mine = dotForPosition(drawn, waiting);
    const other = shuffled.indexOf(mine);
    [shuffled[FAN], shuffled[other]] = [shuffled[other], shuffled[FAN]];
    order.current = shuffled;
  }, [drawn, waiting]);

  useEffect(() => {
    // Arriving already admitted, there was no Draw to watch: stand at the gate.
    const places = order.current ?? Array.from({ length: DOTS }, (_, i) => i);
    goal.current = { dots: targets(phase, places), jump: reducedMotion };
  }, [phase, reducedMotion]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    const dots: Dot[] = Array.from({ length: DOTS }, (_, i) => ({ ...crowdPoint(i), alpha: 1 }));
    let frame = 0;
    let last = performance.now();

    const draw = (time: number) => {
      const seconds = Math.min(0.05, (time - last) / 1000);
      last = time;

      // Match the drawing surface to the element, sharp on dense screens.
      const ratio = window.devicePixelRatio || 1;
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (element.width !== Math.round(width * ratio)) {
        element.width = Math.round(width * ratio);
        element.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const { dots: aim, jump } = goal.current;
      const ease = jump ? 1 : Math.min(1, seconds * FOLLOW);
      const radius = Math.max(2, Math.min(width, height) / 130);

      for (let i = DOTS - 1; i >= 0; i--) {
        const dot = dots[i];
        const to = aim[i] ?? dot;
        dot.x += (to.x - dot.x) * ease;
        dot.y += (to.y - dot.y) * ease;
        dot.alpha += (to.alpha - dot.alpha) * ease;
        if (dot.alpha < 0.02) continue;

        const mine = i === FAN;
        context.globalAlpha = mine ? 1 : dot.alpha * 0.55;
        context.fillStyle = mine ? COLOR.stateMine : COLOR.flood500;
        context.beginPath();
        context.arc(dot.x * width, dot.y * height, mine ? radius * 1.9 : radius, 0, Math.PI * 2);
        context.fill();
        if (mine) {
          // A ring, so this Fan's dot is told apart by shape as well as colour.
          context.globalAlpha = 0.5;
          context.strokeStyle = COLOR.stateMine;
          context.lineWidth = 1.5;
          context.beginPath();
          context.arc(dot.x * width, dot.y * height, radius * 3.4, 0, Math.PI * 2);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvas}
      className="h-full w-full"
      role="img"
      aria-label="The Fans in the Waiting Room as dots. The bright dot is you."
    />
  );
}
