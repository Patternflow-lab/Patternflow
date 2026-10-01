"use client";

import { createContext, useContext } from "react";
import type { BomRow } from "./bom";

// The BOM's rows, from the Build page's route (read when it is built,
// bom.server.ts) down to the cards inside its steps. null: the file couldn't
// be read, and the card says where it is instead.

const Bom = createContext<BomRow[] | null>(null);

export function BomProvider({ rows, children }: { rows: BomRow[] | null; children: React.ReactNode }) {
  return <Bom.Provider value={rows}>{children}</Bom.Provider>;
}

export function useBom(): BomRow[] | null {
  return useContext(Bom);
}
