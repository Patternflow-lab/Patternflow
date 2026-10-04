import type { ReactNode } from "react";
import GuideWorld from "@/components/guide/world/GuideWorld";

// Everything under /guide — the hub, Build, Play, Make and Audio, in both languages
// — is one world: this layout mounts the guide's stage once (GuideWorld), and
// it stays up while the reader moves between the pages. A layout is not
// rendered again on a navigation inside it, so the 3D canvas, the camera, the
// simulated board and the loaded models carry over; each page only says
// which one it is (components/guide/world/usePage.ts).

export default function GuideLayout({ children }: { children: ReactNode }) {
  return <GuideWorld>{children}</GuideWorld>;
}
