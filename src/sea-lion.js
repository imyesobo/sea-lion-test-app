/**
 * Registers the @yesobo/sea-lion custom elements used by this app.
 *
 * Every UI primitive in the app (`<sea-button>`, `<sea-input>`, `<sea-select>`,
 * `<sea-card>`, …) comes from @yesobo/sea-lion. Keeping the registrations in a
 * single module makes it trivial to swap the library version (or a fork) and
 * to see at a glance which components the app depends on.
 *
 * Per-component imports keep the bundle small; `import '@yesobo/sea-lion/define.js'`
 * would register every element instead.
 */
import '@yesobo/sea-lion/src/components/alert/sea-alert.js';
import '@yesobo/sea-lion/src/components/badge/sea-badge.js';
import '@yesobo/sea-lion/src/components/button/sea-button.js';
import '@yesobo/sea-lion/src/components/card/sea-card.js';
import '@yesobo/sea-lion/src/components/input/sea-input.js';
import '@yesobo/sea-lion/src/components/progress/sea-progress.js';
import '@yesobo/sea-lion/src/components/radio-group/sea-radio-group.js';
import '@yesobo/sea-lion/src/components/radio-group/sea-radio.js';
import '@yesobo/sea-lion/src/components/select/sea-select.js';
import '@yesobo/sea-lion/src/components/switch/sea-switch.js';
import '@yesobo/sea-lion/src/components/textarea/sea-textarea.js';
