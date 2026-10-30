import { svg } from 'lit';

/**
 * Small inline SVG icons (Lucide, ISC licence) used inside `<sea-button>`s.
 * They inherit `currentColor` and are sized by sea-lion's button styles.
 */
const icon = content => svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>${content}</svg>`;

export const sendIcon = icon(
  svg`<path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />`,
);

export const stopIcon = icon(
  svg`<rect x="6" y="6" width="12" height="12" rx="1" />`,
);

export const plusIcon = icon(svg`<path d="M5 12h14" /><path d="M12 5v14" />`);

export const settingsIcon = icon(
  svg`<path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />`,
);

export const closeIcon = icon(
  svg`<path d="M18 6 6 18" /><path d="m6 6 12 12" />`,
);

export const alertIcon = icon(
  svg`<circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />`,
);
