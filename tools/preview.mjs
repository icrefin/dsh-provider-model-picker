/**
 * Render the built client bundle outside the GUI and screenshot it.
 *
 * The seat registration is verified against the live app through the client
 * inspection providers; this harness answers the other half — that the control
 * and its two-level menu actually paint. It builds `lib/client.js` when the
 * artifact is missing, loads it through a stub `window.__ModuleLoader__`, calls
 * the plugin's `apply` with a minimal fake client context whose
 * `slots.register` records the entry, and then mounts the recorded seat twice
 * over one fake catalog: once with the root pane open, once drilled into the
 * model pane, where **two providers offer a model of the same name** — the
 * ambiguity the trigger label removes.
 *
 * Nothing here reads a DSH profile and nothing touches the network: the harness
 * writes one self-contained HTML file into a temp directory and opens it with
 * headless Google Chrome.
 *
 * Usage (needs Google Chrome on the host):
 *
 *     node tools/preview.mjs [--out <dir>] [--png <file>] [--open]
 *
 * `--out` is where the harness HTML is written (a temp directory by default);
 * `--png` is the screenshot to produce, resolved against the current directory.
 *
 * @module dsh-provider-model-picker/tools/preview
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')
const bundle = join(packageRoot, 'lib', 'client.js')

/** Chrome binaries to try, in order. */
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

/**
 * The fake per-session model directory the seat renders from. Two providers
 * advertise the very same model name, which is exactly the case the
 * `Provider/Model` label exists for: the name alone cannot tell them apart.
 */
const STATE = {
  current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash', reasoningEffort: 'high' },
  routable: true,
  groups: [
    {
      id: 'deepseek-account',
      name: 'DeepSeek Account',
      models: [{ id: 'deepseek-chat', name: 'DeepSeek-V3.2' }],
    },
    {
      id: 'deepseek-demo',
      name: 'DeepSeek Demo',
      models: [
        {
          id: 'deepseek-v4.1-flash',
          name: 'DeepSeek-V4.1-Flash',
          reasoning: {
            defaultEffort: 'high',
            efforts: [
              { id: 'low', name: 'Low' },
              { id: 'medium', name: 'Medium' },
              { id: 'high', name: 'High' },
            ],
          },
        },
        { id: 'deepseek-v4.1-pro', name: 'DeepSeek-V4.1-Pro' },
      ],
    },
    {
      id: 'baidu-team',
      name: 'Baidu Team',
      models: [
        { id: 'bd-deepseek-v4.1-flash', name: 'DeepSeek-V4.1-Flash' },
        { id: 'bd-deepseek-v4.1-pro', name: 'DeepSeek-V4.1-Pro' },
      ],
    },
  ],
  failures: [],
  status: 'ready',
  pending: null,
  error: null,
}

/** English copy, mirrored from src/client/locales.ts. */
const DICT = {
  'provider.account': 'DeepSeek Account',
  'trigger.fallback': 'Select model',
  'trigger.loading': 'Loading models…',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {model}',
  'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'menu.aria': 'Model and reasoning effort',
  'menu.model': 'Model',
  'menu.effort': 'Effort',
  'menu.loading': 'Refreshing the model list…',
  'effort.providerDefault': 'Default',
  'search.placeholder': 'Search models…',
  'search.clear': 'Clear search',
  'search.empty': 'No matching models.',
  'empty.models': 'No models available.',
  'empty.efforts': 'This model provides no reasoning effort levels.',
  'error.action': 'Model action failed: {message}',
  'error.sessionInUse': 'This session is already in use.',
  'warning.groupLoad': '{name} failed to load: {message}',
  'action.reload': 'Reload',
  'failure.label': 'picker error',
  'failure.handBack': 'click to use the default picker',
}

/**
 * The harness page: React UMD builds, the stub loader, the fake client context,
 * then two mounted seats — the left one with the root pane open, the right one
 * drilled into the model list.
 *
 * @param reactDir - path to the `react` package directory.
 * @param reactDomDir - path to the `react-dom` package directory.
 * @param bundleSource - the built `lib/client.js` source.
 * @returns the self-contained HTML document.
 */
function page(reactDir, reactDomDir, bundleSource) {
  const react = readFileSync(join(reactDir, 'umd', 'react.development.js'), 'utf8')
  const reactDom = readFileSync(join(reactDomDir, 'umd', 'react-dom.development.js'), 'utf8')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Provider / Model preview</title>
<style>
:root{
color-scheme:light;
--dsw-radius-sm:6px;--dsw-radius-md:8px;--dsw-radius-lg:12px;
--dsw-alias-bg-base:#ffffff;--dsw-alias-bg-overlay:#ffffff;--dsw-alias-bg-module-platform:#f1f2f4;
--dsw-alias-label-primary:#1a1b1e;--dsw-alias-label-secondary:#52555c;--dsw-alias-label-tertiary:#85888f;
--dsw-alias-label-caption:#a2a5ab;--dsw-alias-label-dimmed:#c3c5ca;
--dsw-alias-interactive-bg-hover:rgba(26,27,30,.06);--dsw-alias-interactive-bg-hover-danger:rgba(217,59,54,.09);
--dsw-alias-state-error-primary:#d93b36;--dsw-alias-state-warn-label:#a9690a;--dsw-alias-state-business-primary:#3b6df5;
--dsw-alias-menu-icon:#85888f;--dsw-menu-surface-fill:#ffffff;--dsw-menu-backdrop-filter:none;
--dsw-menu-group-header-fill:#ffffff;--dsw-focus-ring-color:rgba(59,109,245,.45);
--dsw-elevation-prominent:0 10px 30px rgba(16,18,22,.16),0 2px 8px rgba(16,18,22,.08);
--dsw-alias-scrollbar-bg-l2:#d2d4d8;--dsw-alias-scrollbar-hover-l2:#a2a5ab;
--dsh-composer-model-icon-display:block;
}
html,body{margin:0;height:100%;background:#fafafb;color:#1a1b1e;
font-family:-apple-system,"SF Pro Text",Inter,system-ui,"PingFang SC",sans-serif;-webkit-font-smoothing:antialiased}
.stage{box-sizing:border-box;height:100vh;padding:32px 40px 28px;display:flex;gap:36px}
.col{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;gap:10px}
.cap{font-size:12.5px;line-height:18px;color:#85888f;min-height:36px}
.cap b{color:#52555c;font-weight:600}
.composer{box-sizing:border-box;border:1px solid #e4e5e8;border-radius:14px;background:#fff;
box-shadow:0 1px 2px rgba(16,18,22,.05);padding:16px 14px 8px}
.composer p{margin:0 0 26px;color:#a2a5ab;font-size:14px;line-height:22px}
.toolbar{display:flex;align-items:center;gap:8px;justify-content:flex-end;
border-top:1px solid #f1f2f4;padding-top:6px;min-height:40px}
</style></head>
<body>
<div class="stage">
  <div class="col">
    <div class="composer">
      <p>Ask anything…</p>
      <div class="toolbar" id="seat-root"></div>
    </div>
    <div class="cap"><b>Root pane.</b> The trigger names the provider beside the model;
    Model and Effort drill one level deeper.</div>
  </div>
  <div class="col">
    <div class="composer">
      <p>Ask anything…</p>
      <div class="toolbar" id="seat-model"></div>
    </div>
    <div class="cap"><b>Model pane.</b> DeepSeek Demo and Baidu Team both offer
    DeepSeek-V4.1-Flash — the bare name cannot tell them apart.</div>
  </div>
</div>
<script>${react}</script>
<script>${reactDom}</script>
<script>
window.__ModuleLoader__ = { load: (definition) => { window.__definition = definition } }
const jsxRuntime = {
  Fragment: React.Fragment,
  jsx: (type, props) => React.createElement(type, props || {}),
  jsxs: (type, props) => React.createElement(type, props || {}),
}
window.__harnessRequire = (name) => {
  if (name === 'react') return React
  if (name === 'react/jsx-runtime') return jsxRuntime
  if (name === 'react-dom') return ReactDOM
  throw new Error('unexpected require: ' + name)
}
</script>
<script>${bundleSource}</script>
<script>
const DICT = ${JSON.stringify(DICT)}
const STATE = ${JSON.stringify(STATE)}

/** Translate through the plugin's own English dictionary. */
const t = (key, params) => {
  let text = DICT[key] !== undefined ? DICT[key] : key
  for (const name of Object.keys(params || {})) text = text.split('{' + name + '}').join(String(params[name]))
  return text
}

// One directory double, shared by both seats, exactly as the service hands the
// same per-session directory to every surface that asks for it.
const directory = {
  store: { getSnapshot: () => STATE, subscribe: () => () => {} },
  load: () => Promise.resolve(STATE),
  select: () => Promise.resolve({ ok: true }),
}

const registered = []
const slots = {
  register: (options, component) => { registered.push({ options, component }); return () => {} },
  inject: (_key, callback) => callback(),
}
const ctx = {
  effect: (callback) => { callback() },
  locale: { register: () => () => {}, bind: () => t },
  slots,
  inject: (_services, callback) => callback({
    effect: (callback) => { callback() },
    slots,
    modelDirectories: { directoryFor: () => directory },
    sessions: { subagentAddress: () => undefined },
  }),
}

window.__definition.factory(window.__harnessRequire).apply(ctx)
const seat = registered.find((entry) => entry.options.name === 'conversation.input.model')
if (seat === undefined) throw new Error('the bundle did not shadow conversation.input.model')

/** Mount the registered seat into one container and return its trigger. */
function mount(container, sessionId) {
  const root = ReactDOM.createRoot(container)
  root.render(React.createElement(seat.component, { locked: false, t, ...seat.options.inject(sessionId) }))
  return root
}

/** Press a button the way a user does, through React's listener. */
function press(element) {
  if (element === null) throw new Error('nothing to press')
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** The trigger of one mounted seat. */
function triggerOf(id) {
  return document.querySelector('#' + id + ' button[aria-haspopup="menu"]')
}

/**
 * Run each step in its own task: outside React's act() wrapper a state update
 * commits on a later tick, so a menu is not in the DOM yet on the line after the
 * click that opened it. Each step therefore waits for the previous commit
 * before reading the DOM again.
 */
function sequence(steps) {
  const run = (index) => {
    if (index >= steps.length) return
    setTimeout(() => {
      steps[index]()
      run(index + 1)
    }, 60)
  }
  setTimeout(() => { run(0) }, 100)
}

const rootSeat = mount(document.getElementById('seat-root'), 'preview-root')
const modelSeat = mount(document.getElementById('seat-model'), 'preview-model')

// Open both menus, then drill the right-hand one into the model list.
sequence([
  () => { press(triggerOf('seat-root')) },
  () => { press(triggerOf('seat-model')) },
  () => {
    const menu = document.getElementById(triggerOf('seat-model').getAttribute('aria-controls'))
    press(menu.querySelector('.dpmp-cell'))
  },
  () => {
    // A synthetic click is a keyboard-ish focus for :focus-visible, which a real
    // mouse click is not; drop the focus so the shot shows the resting control.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.__ready = true
  },
])
</script>
</body></html>`
}

/**
 * Run the screenshot through a headless Chrome.
 *
 * The browser gets its own scratch profile under the output directory: it never
 * opens the user's profile, and a read-only or sandboxed home directory cannot
 * stop the render. The browser's own sandbox is off for the same reason — a
 * shell that refuses its crashpad and GPU writes kills the process before it
 * paints — and the only page it ever loads is the file written above.
 *
 * @param chrome - the browser binary.
 * @param file - the harness HTML.
 * @param png - the screenshot to write.
 * @param profile - a scratch user-data directory for this run.
 * @param width - viewport width in pixels.
 * @param height - viewport height in pixels.
 */
function screenshot(chrome, file, png, profile, width, height) {
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      // Crashpad lives in the user's own Chrome directory; when that write is
      // refused, every retry it makes slows the run down.
      '--disable-crash-reporter',
      '--hide-scrollbars',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${String(width)},${String(height)}`,
      '--virtual-time-budget=8000',
      `--screenshot=${png}`,
      `file://${file}`,
    ],
    { stdio: 'pipe' },
  )
}

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = argv.indexOf(name)
  return index === -1 ? fallback : argv[index + 1]
}

// The browser half only exists after a build, and the bundle is gitignored, so
// a fresh checkout has to build it before this harness can render anything.
if (!existsSync(bundle)) {
  console.log('lib/client.js is missing — running `pnpm build` …')
  execFileSync('pnpm', ['build'], { cwd: packageRoot, stdio: 'inherit' })
}
if (!existsSync(bundle)) {
  console.error('lib/client.js is still missing after `pnpm build`.')
  process.exit(1)
}

const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (chrome === undefined) {
  console.error('No Chrome-family browser found; looked at:\n  ' + CHROME_CANDIDATES.join('\n  '))
  process.exit(1)
}

const defaultOut = join(tmpdir(), 'dsh-provider-model-picker-preview')
const outDir = resolve(flag('--out', defaultOut))
const png = resolve(flag('--png', join(outDir, 'provider-model-control.png')))
// Only the harness's own scratch directory is cleared: `--out` may name a
// directory the caller keeps other files in.
if (outDir === resolve(defaultOut)) rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
mkdirSync(dirname(png), { recursive: true })

const file = join(outDir, 'index.html')
const modules = join(packageRoot, 'node_modules')
writeFileSync(file, page(join(modules, 'react'), join(modules, 'react-dom'), readFileSync(bundle, 'utf8')))
screenshot(chrome, file, png, join(outDir, 'chrome-profile'), 1440, 900)
console.log(`preview html: ${file}`)
console.log(`screenshot:   ${png}`)
if (argv.includes('--open')) execFileSync('open', [png])
