"use client";

import dynamic from "next/dynamic";
import type { Block } from "@/lib/domain/types";

// Three.js needs a browser, so the canvas is loaded only on the client, and
// only on this page: no other page pays for the 3D code.
const StadiumCanvas = dynamic(() => import("./stadium-canvas"), {
  ssr: false,
  loading: () => <StadiumLoading />,
});

export function StadiumLoading() {
  return (
    <div className="flex h-full items-center justify-center" role="status">
      <p className="text-flood-300">Building the stadium</p>
    </div>
  );
}

export function StadiumView({ blocks }: { blocks: Block[] }) {
  return <StadiumCanvas blocks={blocks} />;
}
