import type { Metadata } from "next";
import Link from "next/link";

// Next adds the noindex tag to a not-found page itself.
export const metadata: Metadata = {
  title: "Page not found / Patternflow",
};

export default function NotFound() {
  return (
    <main className="signal-lost">
      <h1>404</h1>
      <Link href="/" prefetch={false}>Return to main</Link>
    </main>
  );
}
