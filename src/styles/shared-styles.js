import { css } from 'lit';
import { t } from '@yesobo/sea-lion/src/tokens/tokens.js';

/**
 * Shared styles and design tokens for the app's own components.
 *
 * Colours, radii, typography and motion all come from the @yesobo/sea-lion
 * design tokens (`--sl-*` CSS custom properties, read through `t()`), so the
 * app follows the library theme – including dark mode – automatically.
 */
export { t };

/** App-level spacing / layout tokens (themable via `--app-*`). */
export const appTokens = css`
  :host {
    --app-gap: 1rem;
    --app-sidebar-width: 22rem;
    --app-content-max-width: 52rem;
  }
`;

/** Base reset shared by every app component. */
export const baseStyles = css`
  :host {
    box-sizing: border-box;
    font-family: ${t('font-sans')};
    color: ${t('foreground')};
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .muted {
    color: ${t('muted-foreground')};
    font-size: ${t('text-sm')};
  }

  a {
    color: inherit;
    text-underline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
