"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, type CanvasTexture, Color, SRGBColorSpace } from "three";
import { COLOR } from "@/lib/design/tokens";
import { glowTexture } from "../stadium/painted";

// The LED board over the gate. It is drawn on a canvas and used as a
// texture, so the text is sharp, sits flat on the board at its angle, and
// is fogged and lit like the rest of the scene. The board is drawn brighter
// than anything round it and has a soft glow behind it, as a lit screen does
// at night.

export interface BoardText {
  /** "FC Barcelona v RCD Espanyol" */
  fixture: string;
  /** "La Liga · Sat 19 Dec · 21:00" */
  details: string;
  /** "Fans admitted" */
  label: string;
  /** "1,234" */
  value: string;
}

const WIDTH = 1536;
const HEIGHT = 560;

/** The board in metres, and where it hangs: over the beam of the gate. */
const BOARD_WIDTH = 15.4;
const BOARD_HEIGHT = (BOARD_WIDTH * HEIGHT) / WIDTH;
const BOARD_Y = 11.8 + BOARD_HEIGHT / 2;
const BOARD_Z = 1.6;

/** The font a CSS variable stands for, so the canvas draws with the site's own fonts. */
function family(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/** Shrinks a font until the text fits the width. Returns the size used. */
function fit(context: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, width: number) {
  let s = size;
  context.font = font(s);
  while (s > 12 && context.measureText(text).width > width) {
    s -= 4;
    context.font = font(s);
  }
  return s;
}

function draw(context: CanvasRenderingContext2D, text: BoardText) {
  const display = family("--font-big-shoulders", "sans-serif");
  const mono = family("--font-geist-mono", "monospace");
  const sans = family("--font-geist-sans", "sans-serif");
  const pad = 72;

  context.fillStyle = COLOR.night950;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // The LED grain: faint dots across the whole face.
  context.fillStyle = COLOR.night900;
  for (let y = 4; y < HEIGHT; y += 8) {
    for (let x = 4; x < WIDTH; x += 8) context.fillRect(x, y, 4, 4);
  }

  // A stripe in the club colours along the foot of the board.
  context.fillStyle = COLOR.seatBlau;
  context.fillRect(0, HEIGHT - 22, WIDTH / 2, 22);
  context.fillStyle = COLOR.seatGrana;
  context.fillRect(WIDTH / 2, HEIGHT - 22, WIDTH / 2, 22);

  context.textBaseline = "alphabetic";
  context.textAlign = "left";

  context.fillStyle = COLOR.flood300;
  fit(context, text.details.toUpperCase(), (s) => `600 ${s}px ${sans}`, 60, WIDTH - pad * 2);
  context.fillText(text.details.toUpperCase(), pad, 124);

  context.fillStyle = COLOR.flood50;
  fit(context, text.fixture.toUpperCase(), (s) => `800 ${s}px ${display}`, 168, WIDTH - pad * 2);
  context.fillText(text.fixture.toUpperCase(), pad, 292);

  // The live line: a label on the left, the number on the right, in the data font.
  context.fillStyle = COLOR.night900;
  context.fillRect(pad, 340, WIDTH - pad * 2, 3);
  context.fillStyle = COLOR.flood300;
  context.font = `600 68px ${sans}`;
  context.fillText(text.label.toUpperCase(), pad, 470);
  context.fillStyle = COLOR.flood50;
  context.textAlign = "right";
  context.font = `500 132px ${mono}`;
  context.fillText(text.value, WIDTH - pad, 480);
}

export function GateBoard({ text }: { text: BoardText }) {
  const [canvas] = useState(() => {
    const element = document.createElement("canvas");
    element.width = WIDTH;
    element.height = HEIGHT;
    return element;
  });
  const texture = useRef<CanvasTexture>(null);
  const glow = useMemo(() => glowTexture(), []);
  const glowColour = useMemo(() => new Color(COLOR.flood300), []);
  // Fonts load after the page; the board is drawn again once they are in.
  const [fontsIn, setFontsIn] = useState(false);

  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => live && setFontsIn(true));
    return () => {
      live = false;
    };
  }, []);

  const { fixture, details, label, value } = text;
  useEffect(() => {
    const context = canvas.getContext("2d");
    if (!context) return;
    draw(context, { fixture, details, label, value });
    if (texture.current) texture.current.needsUpdate = true;
  }, [canvas, fixture, details, label, value, fontsIn]);

  return (
    <group position={[0, BOARD_Y, BOARD_Z]}>
      {/* The glow comes first and does not hide anything behind it. */}
      <mesh position={[0, 0, -0.3]} raycast={() => null}>
        <planeGeometry args={[BOARD_WIDTH * 1.9, BOARD_HEIGHT * 3]} />
        <meshBasicMaterial
          map={glow}
          color={glowColour}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -0.25]} raycast={() => null}>
        <boxGeometry args={[BOARD_WIDTH + 0.6, BOARD_HEIGHT + 0.6, 0.4]} />
        <meshLambertMaterial color={COLOR.night950} />
      </mesh>
      <mesh raycast={() => null}>
        <planeGeometry args={[BOARD_WIDTH, BOARD_HEIGHT]} />
        <meshBasicMaterial toneMapped={false}>
          <canvasTexture
            ref={texture}
            attach="map"
            args={[canvas]}
            colorSpace={SRGBColorSpace}
            anisotropy={8}
          />
        </meshBasicMaterial>
      </mesh>
    </group>
  );
}
