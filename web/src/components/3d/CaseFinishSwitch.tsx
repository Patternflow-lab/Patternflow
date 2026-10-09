'use client';

import type { CaseFinish } from './caseModels';
import styles from './CaseFinishSwitch.module.css';

interface CaseFinishSwitchProps {
  /** Names the group for a screen reader: whose material this is. */
  label: string;
  finishes: CaseFinish[];
  value: string;
  onChange: (finish: string) => void;
}

/**
 * The materials a case can be made in, under the device in the product
 * preview — SimonePDA's case is cut from clear acrylic or from MDF, and the
 * preview shows either. A row of toggle buttons rather than tabs: it changes
 * the picture, it opens nothing.
 */
export default function CaseFinishSwitch({ label, finishes, value, onChange }: CaseFinishSwitchProps) {
  return (
    <div className={styles.switch} role="group" aria-label={label}>
      {finishes.map((finish) => (
        <button
          key={finish.id}
          type="button"
          className={styles.option}
          aria-pressed={finish.id === value}
          onClick={() => onChange(finish.id)}
        >
          {finish.label}
        </button>
      ))}
    </div>
  );
}
