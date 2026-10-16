import type { Metadata } from "next";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";
import ContactPage from "@/components/contact/ContactPage";

export const metadata: Metadata = {
  title: "Contact / Patternflow",
  description:
    "Partnership, installation, distribution, and custom AV inquiries for Patternflow.",
  openGraph: { ...SITE_OPEN_GRAPH, url: "/contact" },
};

export default function ContactRoute() {
  return <ContactPage />;
}
