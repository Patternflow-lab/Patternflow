import type { CSSProperties } from "react";
import styles from "../Guide.module.css";

// A title, word by word: each word stands in a mask of its own and rises into
// it, one after another along the line (Guide.module.css "words behind
// masks"). The words are still the title's text — a real space between each,
// nothing hidden from a screen reader, a copy or a search — and they wrap
// where the plain title would: the masks are clips, not boxes.
//
// Who starts it is the block's business: `.wordsNow` on the title for one on
// a page's first screen (it plays on arrival), or a [data-reveal] block that
// is marked the first time the reader reaches it (ui/useReveal).

/** `from`: the first word's place in the line of things arriving (its delay is from × 55 ms). */
export default function Words({ text, from = 0 }: { text: string; from?: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((word, i) => (
        // The space is outside the mask, so the line breaks between words as it always did.
        <span key={i}>
          <span className={styles.w}>
            <span style={{ "--i": from + i } as CSSProperties}>{word}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
