import type { JournalLang } from "@/lib/journal";
import styles from "./LanguageSwitch.module.css";

type LanguageSwitchProps = {
  lang: JournalLang;
  slug?: string;
};

export default function LanguageSwitch({ lang, slug }: LanguageSwitchProps) {
  const koPath = slug ? `/journal/${slug}` : "/journal";
  const enPath = slug ? `/journal/${slug}/en` : "/journal/en";
  const koHref = lang === "ko" ? koPath : `${koPath}?lang=ko`;
  const enHref = lang === "en" ? enPath : `${enPath}?lang=en`;

  return (
    <nav className="journal-lang-switch" aria-label="Journal language">
      <a
        className={`${styles.target}${lang === "ko" ? " active" : ""}`}
        href={koHref}
        hrefLang="ko"
        aria-current={lang === "ko" ? "page" : undefined}
      >
        ko
      </a>
      <a
        className={`${styles.target}${lang === "en" ? " active" : ""}`}
        href={enHref}
        hrefLang="en"
        aria-current={lang === "en" ? "page" : undefined}
      >
        en
      </a>
    </nav>
  );
}
