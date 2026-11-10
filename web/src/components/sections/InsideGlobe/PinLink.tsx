'use client';

import type { MouseEvent } from 'react';

// A link on a pin. A path into the site (/build?case=…) stays in this tab and
// changes it: the address moves, and the tabs follow it on popstate the way
// they follow Back, so the 3D scene is not loaded again. A full address opens
// in a new tab, with ↗. A modified click is left to the browser either way.
export default function PinLink({
  href,
  label,
  className,
  onClick,
}: {
  href: string;
  label: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  // One slash, not two: //host is an address on another site.
  if (!/^\/(?!\/)/.test(href)) {
    return (
      <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {label} ↗
      </a>
    );
  }

  return (
    <a
      className={className}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        window.history.pushState(null, '', href);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }}
    >
      {label} →
    </a>
  );
}
