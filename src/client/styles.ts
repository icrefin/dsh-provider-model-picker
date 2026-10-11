/**
 * The control's stylesheet.
 *
 * The trigger rules are the shipped composer model control's CSS copied under
 * this plugin's own `dpmp-` prefix (including the two
 * `--dsh-composer-model-*-display` variables the composer row sets when the
 * expanded controls cannot share a line), so the shadowed seat occupies the
 * same box and follows the same compact/expanded switch. The menu is a
 * hand-written surface built from the same theme tokens the platform's
 * `MenuSurface` uses — no host UI package is imported, because a renamed
 * primitive would otherwise blank the seat.
 *
 * Every color is a `--dsw-*` token, so light and dark both work. The tag is
 * created from the bundle's factory body, so the client module system claims it
 * and removes it again when the plugin is unloaded.
 *
 * @module dsh-provider-model-picker/client/styles
 */

/** Id of the stylesheet tag, so injection stays idempotent. */
export const STYLE_ID = 'dsh-provider-model-picker-style'

/** Class names the component uses, kept beside the CSS that defines them. */
export const CSS = {
  root: 'dpmp-root',
  trigger: 'dpmp-trigger',
  triggerLabel: 'dpmp-triggerLabel',
  triggerEffort: 'dpmp-triggerEffort',
  triggerIcon: 'dpmp-triggerIcon',
  chevron: 'dpmp-chevron',
  chevronOpen: 'dpmp-chevronOpen',
  crash: 'dpmp-crash',
  menu: 'dpmp-menu',
  surface: 'dpmp-surface',
  material: 'dpmp-material',
  backing: 'dpmp-backing',
  status: 'dpmp-status',
  error: 'dpmp-error',
  warning: 'dpmp-warning',
  retry: 'dpmp-retry',
  searchRow: 'dpmp-searchRow',
  search: 'dpmp-search',
  searchWithQuery: 'dpmp-searchWithQuery',
  searchClear: 'dpmp-searchClear',
  groups: 'dpmp-groups',
  group: 'dpmp-group',
  heading: 'dpmp-heading',
  option: 'dpmp-option',
  optionActive: 'dpmp-selected',
  optionCopy: 'dpmp-optionCopy',
  modelName: 'dpmp-modelName',
  check: 'dpmp-check',
  cell: 'dpmp-cell',
  cellLabel: 'dpmp-cellLabel',
  cellValue: 'dpmp-cellValue',
  cellChevron: 'dpmp-cellChevron',
  spinner: 'dpmp-spinner',
  spinnerTrack: 'dpmp-spinnerTrack',
  spinnerArc: 'dpmp-spinnerArc',
} as const

/** Theme-token-only stylesheet for the trigger and its menu. */
export const PICKER_CSS = `
.dpmp-root{min-width:0;position:relative}
.dpmp-trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:min(360px,45cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:400;line-height:20px;display:flex}
.dpmp-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dpmp-trigger:focus-visible:not([data-selection-focus]){box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}
.dpmp-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.dpmp-triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}
.dpmp-triggerEffort{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-caption);flex-shrink:1000;overflow:hidden}
.dpmp-triggerIcon{display:var(--dsh-composer-model-icon-display,none);flex:none}
.dpmp-triggerLabel,.dpmp-triggerEffort{display:var(--dsh-composer-model-text-display,block)}
.dpmp-chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}
.dpmp-chevronOpen{transform:rotate(180deg)}
.dpmp-crash{align-items:center;gap:6px;min-width:0;max-width:min(520px,50cqw);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);padding:2px 6px;font-size:11px;line-height:16px;display:flex}
.dpmp-surface{z-index:1100;box-sizing:border-box;width:max-content;min-width:min(240px,100vw - 32px);max-width:min(420px,100vw - 32px);max-height:min(360px,100vh - 96px);border-radius:var(--dsw-radius-lg);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);isolation:isolate;flex-direction:column;display:flex;position:fixed;overflow:hidden}
.dpmp-material{position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--dsw-menu-surface-fill,var(--dsw-alias-bg-overlay));backdrop-filter:var(--dsw-menu-backdrop-filter,none);pointer-events:none}
.dpmp-backing{display:none}
html[data-platform='darwin'] .dpmp-backing{display:block;position:absolute;inset:0;z-index:-2;border-radius:inherit;background:var(--dsw-alias-bg-base);pointer-events:none}
.dpmp-menu{flex-direction:column;min-height:0;padding:4px;display:flex}
.dpmp-status,.dpmp-empty{color:var(--dsw-alias-label-tertiary);padding:8px;font-size:12px;line-height:18px}
.dpmp-error,.dpmp-warning{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:3px;padding:6px 7px;font-size:11px;line-height:16px;display:flex}
.dpmp-warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}
.dpmp-retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}
.dpmp-searchRow{flex-shrink:0;margin:2px 0 3px;position:relative}
.dpmp-search{box-sizing:border-box;width:100%;border-radius:var(--dsw-radius-md);background:0 0;border:0;outline:none;padding:5px 7px;font-size:12px;font-family:inherit;color:inherit}
.dpmp-search::placeholder{color:var(--dsw-alias-label-caption)}
.dpmp-searchWithQuery{padding-right:34px}
.dpmp-searchClear{width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;top:50%;right:4px;transform:translateY(-50%)}
.dpmp-searchClear:hover,.dpmp-searchClear:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dpmp-groups{min-height:0;overflow-y:auto}
.dpmp-heading{position:sticky;top:0;z-index:1;padding:4px 7px 2px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-menu-group-header-fill,var(--dsw-menu-surface-fill,var(--dsw-alias-bg-overlay)));color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-weight:500}
.dpmp-group+.dpmp-group{margin-top:3px}
.dpmp-option{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;min-height:34px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:5px 7px;display:flex}
.dpmp-option:hover:not(:disabled),.dpmp-option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dpmp-option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.dpmp-optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}
.dpmp-modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:400;line-height:18px;overflow:hidden}
.dpmp-check{color:var(--dsw-alias-label-primary);flex:0 0 14px;place-items:center;display:grid}
.dpmp-check svg{width:14px;height:14px}
.dpmp-cell{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:0 8px;font-size:13px;line-height:20px;display:flex}
.dpmp-cell:hover,.dpmp-cell:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dpmp-cellLabel{white-space:nowrap;flex:none}
.dpmp-cellValue{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}
.dpmp-cellChevron{width:12px;height:12px;color:var(--dsw-alias-menu-icon);flex:none}
.dpmp-spinner{flex:none;color:var(--dsw-alias-label-tertiary);transform-origin:center;animation:dpmp-spin 1.5s linear infinite}
.dpmp-spinnerTrack,.dpmp-spinnerArc{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.dpmp-spinnerTrack{opacity:.25}
.dpmp-spinnerArc{stroke-dasharray:12 150;animation:dpmp-dash 1.5s ease-in-out infinite}
@keyframes dpmp-spin{to{transform:rotate(360deg)}}
@keyframes dpmp-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}100%{stroke-dasharray:12 150;stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.dpmp-spinner,.dpmp-spinnerArc{animation:none}.dpmp-spinnerArc{stroke-dasharray:18 150;stroke-dashoffset:-3}}
`

/** Append the stylesheet once per document. */
export function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-provider-model-picker'
  style.dataset.pluginCss = STYLE_ID
  style.textContent = PICKER_CSS
  document.head.append(style)
}