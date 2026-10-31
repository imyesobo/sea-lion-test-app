import { css } from 'lit';

export const appStyles = css`
  :host {
    display: block;
    line-height: 1.6;
    --sl-primary: #176653;
    --sl-primary-foreground: #fff;
  }
  * {
    box-sizing: border-box;
  }
  header,
  main,
  footer {
    max-width: 1280px;
    margin: auto;
    padding: 24px 32px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .brand {
    font-size: 1.2rem;
    font-weight: 750;
    letter-spacing: -0.04em;
  }
  .brand span {
    color: #176653;
  }
  .eyebrow {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #176653;
  }
  .hero {
    padding: 28px 0 36px;
    max-width: 740px;
  }
  h1 {
    font-size: clamp(2.2rem, 5vw, 3.8rem);
    line-height: 1.1;
    letter-spacing: -0.055em;
    margin: 14px 0 20px;
    font-weight: 650;
  }
  h2 {
    font-size: 1.15rem;
    line-height: 1.4;
    margin: 0;
  }
  h3 {
    font-size: 1rem;
    margin: 0;
  }
  p {
    margin: 8px 0;
  }
  .muted {
    color: #53645e;
  }
  .hero p {
    font-size: 1.08rem;
  }
  .workspace {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    align-items: start;
    gap: 24px;
  }
  .stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    min-width: 0;
  }
  sea-card {
    min-width: 0;
    --sl-radius-xl: 16px;
  }
  sea-input,
  sea-select {
    display: block;
    margin: 12px 0;
  }
  sea-button {
    max-width: 100%;
  }
  sea-alert {
    display: block;
    margin: 12px 0;
  }
  sea-progress {
    display: block;
    margin: 16px 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .between {
    justify-content: space-between;
  }
  .catalog-list {
    display: grid;
    gap: 8px;
    max-height: 420px;
    overflow: auto;
    padding: 4px;
    margin: 12px -4px;
  }
  .catalog-list sea-button {
    display: block;
    width: 100%;
    text-align: left;
    height: auto;
    white-space: normal;
    padding: 10px 12px;
  }
  .item {
    display: block;
    width: 100%;
  }
  .item small {
    display: block;
    color: #53645e;
  }
  .empty {
    padding: 40px 12px;
    text-align: center;
  }
  .empty-mark {
    font-size: 2.5rem;
    color: #176653;
    margin-bottom: 16px;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin: 24px 0;
  }
  .summary div {
    border-left: 2px solid #d8e7dd;
    padding-left: 12px;
    overflow-wrap: anywhere;
  }
  .summary strong {
    display: block;
    font-size: 1.2rem;
  }
  .summary small {
    color: #53645e;
  }
  .table-wrap {
    overflow: auto;
    max-height: 560px;
    margin: 16px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  caption {
    text-align: left;
    font-size: 0.8rem;
    color: #53645e;
    margin-bottom: 8px;
  }
  th {
    text-align: left;
    background: #edf3ef;
    position: sticky;
    top: 0;
  }
  th,
  td {
    padding: 12px;
    border-bottom: 1px solid #e1e8e3;
    white-space: nowrap;
  }
  td:nth-child(2),
  th:nth-child(2) {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  a {
    color: #176653;
    text-underline-offset: 3px;
    overflow-wrap: anywhere;
  }
  a:focus-visible,
  .table-wrap:focus-visible {
    outline: 3px solid #247b67;
    outline-offset: 3px;
  }
  .source {
    font-size: 0.8rem;
    margin-top: 20px;
  }
  footer {
    color: #53645e;
    font-size: 0.8rem;
    margin-top: 20px;
  }
  .skip {
    position: absolute;
    left: -10000px;
  }
  .skip:focus,
  .skip:focus-within {
    left: 16px;
    top: 16px;
    z-index: 10;
    background: white;
    padding: 12px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 760px) {
    header,
    main,
    footer {
      padding: 20px 16px;
    }
    .workspace {
      grid-template-columns: 1fr;
    }
    .hero {
      padding-top: 12px;
    }
    .summary {
      grid-template-columns: 1fr;
    }
    header .muted {
      display: none;
    }
  }
`;
