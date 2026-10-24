import type { Metadata } from "next";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";
import UpdateClient from "./UpdateClient";

// /update — where a device's console sends you when a newer firmware exists.
//
// Deliberately not part of the community: no sign-in, no build queue, no
// database. The firmware is already a released image, so this page reads the
// public flasher manifest and points your board at it.

export const metadata: Metadata = {
  title: "Firmware update / Patternflow",
  description:
    "Update your Patternflow over Wi-Fi. Your patterns, Wi-Fi networks and storage are untouched — an update rewrites the program only.",
  openGraph: { ...SITE_OPEN_GRAPH, url: "/update" },
};

export default function UpdatePage() {
  return <UpdateClient />;
}
