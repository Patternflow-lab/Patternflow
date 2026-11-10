"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient, dummyEmailFor } from "@/lib/community/auth-client";
import { PASSWORD_MIN, USERNAME_RE } from "@/lib/community/validate";
import { useDialog } from "@/lib/hooks/useDialog";
import { useBackdropClose } from "@/lib/hooks/useBackdropClose";
import styles from "./Community.module.css";

// Username + password auth. Email is an optional recovery field only — when
// left empty a hidden dummy address satisfies Better Auth's schema.

type Props = {
  onClose: () => void;
  /** Called after a successful sign-in/up (session is established). Without
   *  one, the modal refreshes the route itself. */
  onAuthed?: () => void;
  /** Renders without its own overlay when embedded in another modal. */
  embedded?: boolean;
};

export default function AuthModal({ onClose, onAuthed, embedded = false }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = usernameInput.trim();
    setError(null);

    if (!USERNAME_RE.test(name)) {
      setError("Username: 3–20 characters, letters/digits/underscore only.");
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }

    setBusy(true);
    try {
      if (tab === "signup") {
        const recovery = email.trim();
        const result = await authClient.signUp.email({
          email: recovery.length > 0 ? recovery : dummyEmailFor(name),
          password,
          name,
          username: name,
        });
        if (result.error) {
          setError(result.error.message ?? "Sign-up failed.");
          return;
        }
      } else {
        const result = await authClient.signIn.username({ username: name, password });
        if (result.error) {
          setError(result.error.message ?? "Sign-in failed.");
          return;
        }
      }
      // The header's handle follows the session by itself, but what the server
      // rendered does not: after signing in from a card's heart, which passed
      // no onAuthed, the page kept the signed-out CTA and had no Alerts link
      // and no Liked tab until a reload. So a caller with nothing of its own to
      // do gets the refresh every other caller was already asking for.
      if (onAuthed) onAuthed();
      else router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // A form, so Enter signs in from the username field as well as the password
  // one, and a password manager finds a pair of fields to fill.
  const body = (
    <form
      className={styles.modalBody}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) void submit();
      }}
    >
      <div className={styles.authTabs}>
        <button type="button" data-active={tab === "signin"} onClick={() => setTab("signin")}>
          Sign in
        </button>
        <button type="button" data-active={tab === "signup"} onClick={() => setTab("signup")}>
          Create account
        </button>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Username</span>
        <input
          className={styles.textInput}
          value={usernameInput}
          autoComplete="username"
          spellCheck={false}
          onChange={(event) => setUsernameInput(event.target.value)}
        />
        {tab === "signup" && (
          <span className={styles.fieldHint}>3–20 characters: a–z, 0–9, underscore.</span>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Password</span>
        <input
          className={styles.textInput}
          type="password"
          value={password}
          autoComplete={tab === "signup" ? "new-password" : "current-password"}
          onChange={(event) => setPassword(event.target.value)}
        />
        {tab === "signup" && <span className={styles.fieldHint}>At least 8 characters.</span>}
      </label>

      {tab === "signup" && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email (optional, recovery only)</span>
          <input
            className={styles.textInput}
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className={styles.fieldHint}>
            Without an email, a lost password cannot be recovered. No verification mail is sent.
          </span>
        </label>
      )}

      {error && (
        <div className={styles.formError} role="alert">
          {error}
        </div>
      )}

      <button type="submit" className={styles.btnPrimary} disabled={busy}>
        {busy ? "…" : tab === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );

  if (embedded) return body;

  return <AuthWindow onClose={onClose}>{body}</AuthWindow>;
}

// Only the standalone window takes Esc and the focus. Embedded, the window
// around the form owns both.
function AuthWindow({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const cardRef = useDialog<HTMLDivElement>(onClose);
  const closeOnBackdrop = useBackdropClose(onClose);
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" {...closeOnBackdrop}>
      <div
        ref={cardRef}
        tabIndex={-1}
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span>Patternflow Community</span>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
