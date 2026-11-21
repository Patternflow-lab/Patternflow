import { ImageResponse } from "next/og";
import { formatJournalDate, getAllJournalPosts, type JournalLang } from "@/lib/journal";

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * A post's share card, in the language of the page that names it. The two
 * opengraph-image routes (journal/[slug] and journal/[slug]/en) both draw
 * this, so the English page no longer shares the Korean title.
 */
export function journalShareImage(slug: string, lang: JournalLang) {
  const post = getAllJournalPosts({ includeDrafts: true, lang }).find(
    (item) => item.slug === slug,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F4EFE6",
          color: "#141414",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#6B655A",
          }}
        >
          <span>patternflow / journal</span>
          {/* The top line is English capitals on both cards, so the date is
              the English one on the Korean card too. */}
          <span>{post ? formatJournalDate(post.date, "en") : ""}</span>
        </div>
        <div
          style={{
            fontSize: 74,
            lineHeight: 1.02,
            letterSpacing: -3,
            maxWidth: 930,
          }}
        >
          {post?.title ?? "Patternflow Journal"}
        </div>
        <div
          style={{
            width: "100%",
            height: 2,
            background: "#141414",
          }}
        />
      </div>
    ),
    SHARE_IMAGE_SIZE,
  );
}
