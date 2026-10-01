"use client";

import { useEffect } from "react";

/**
 * The site's body is cream. Anything that shows it on a guide page — a fast
 * scroll, an overscroll bounce, the frame before the canvas paints — flashed
 * the whole screen white, so the document itself goes dark while a guide
 * page (or the hub) is open, and back when it closes.
 */
export function useDarkDocument() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = { html: html.style.background, body: document.body.style.background, scheme: html.style.colorScheme };
    html.style.background = "#0a0908";
    document.body.style.background = "#0a0908";
    html.style.colorScheme = "dark";
    return () => {
      html.style.background = prev.html;
      document.body.style.background = prev.body;
      html.style.colorScheme = prev.scheme;
    };
  }, []);
}

/**
 * The root layout serves every page as <html lang="en">, the Korean guide
 * pages too: their own root says lang="ko", the document did not, and a
 * screen reader picks its voice from the document. While a guide page (or
 * the hub) is open the document says the page's language, and goes back to
 * the layout's when it closes.
 */
export function useDocumentLang(lang: string) {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.lang;
    html.lang = lang;
    return () => {
      html.lang = prev;
    };
  }, [lang]);
}
