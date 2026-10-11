/**
 * What the trigger actually renders.
 *
 * The component is rendered with React's static renderer over a real directory
 * double, so the assertions read the markup a user would see — not an
 * intermediate string the test itself assembled.
 *
 * @module dsh-provider-model-picker/test/render
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderModelSelect, Seat } from '../src/client/ModelSelect.tsx'
import { en } from '../src/client/locales.ts'
import { createDirectory, emptyState } from './support.ts'
import type { DirectoryState, ProviderGroup } from '../src/client/format.ts'

const demo: ProviderGroup = {
  id: 'deepseek-demo',
  name: 'DeepSeek Demo',
  models: [
    { id: 'deepseek-v4.1-flash', name: 'DeepSeek-V4.1-Flash' },
    { id: 'deepseek-v4.1-pro', name: 'DeepSeek-V4.1-Pro' },
  ],
}

/** Translate through the plugin's own English dictionary. */
const t = (key: keyof typeof en, params?: Record<string, unknown>): string => {
  let text: string = en[key]
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.split(`{${name}}`).join(String(value))
  }
  return text
}

/**
 * Render the seat over one snapshot.
 * @param state - the directory snapshot to render.
 * @param overrides - prop overrides, e.g. `available: false` or `locked: true`.
 * @returns the static markup.
 */
function render(state: DirectoryState, overrides: Partial<Parameters<typeof ProviderModelSelect>[0]> = {}): string {
  const directory = createDirectory(state)
  return renderToStaticMarkup(
    createElement(ProviderModelSelect, {
      locked: false,
      available: true,
      directory: directory.store,
      load: () => {},
      select: () => Promise.resolve({ ok: true }),
      t,
      ...overrides,
    }),
  )
}

describe('the composer trigger', () => {
  beforeEach(() => {
    // React's static renderer warns about layout effects; they are inert here.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the provider and the model together', () => {
    const markup = render(
      emptyState({
        current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
        groups: [demo],
        status: 'ready',
      }),
    )
    expect(markup).toContain('DeepSeek Demo/DeepSeek-V4.1-Flash')
    expect(markup).toContain('title="DeepSeek Demo/DeepSeek-V4.1-Flash"')
    expect(markup).toContain('aria-label="Select model, current DeepSeek Demo/DeepSeek-V4.1-Flash"')
  })

  it('appends the reasoning effort beside the label', () => {
    const markup = render(
      emptyState({
        current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-pro', reasoningEffort: 'high' },
        groups: [
          {
            id: 'deepseek-demo',
            name: 'DeepSeek Demo',
            models: [
              {
                id: 'deepseek-v4.1-pro',
                name: 'DeepSeek-V4.1-Pro',
                reasoning: { defaultEffort: 'high', efforts: [{ id: 'high', name: 'High' }] },
              },
            ],
          },
        ],
        status: 'ready',
      }),
    )
    expect(markup).toContain('DeepSeek Demo/DeepSeek-V4.1-Pro')
    expect(markup).toContain('>High<')
  })

  it('localizes the account provider', () => {
    const markup = render(
      emptyState({
        current: { provider: 'deepseek-account', model: 'deepseek-chat' },
        groups: [
          { id: 'deepseek-account', name: 'ignored', models: [{ id: 'deepseek-chat', name: 'DeepSeek-V3.2' }] },
        ],
        status: 'ready',
      }),
    )
    expect(markup).toContain('DeepSeek Account/DeepSeek-V3.2')
  })

  it('keeps the loading and unset states', () => {
    expect(render(emptyState({ status: 'loading' }))).toContain('Loading models…')
    expect(render(emptyState({ status: 'ready' }))).toContain('Select model')
  })

  it('renders nothing for an addressed subagent session', () => {
    expect(render(emptyState({ status: 'ready' }), { available: false })).toBe('')
  })

  it('disables the trigger while the composer is locked', () => {
    const markup = render(
      emptyState({
        current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
        groups: [demo],
        status: 'ready',
      }),
      { locked: true },
    )
    expect(markup).toContain('disabled=""')
  })

  it('does not render the menu before it is opened', () => {
    const markup = render(
      emptyState({
        current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
        groups: [demo],
        status: 'ready',
      }),
    )
    expect(markup).not.toContain('dpmp-menu')
    expect(markup).not.toContain('role="menu"')
  })
})

describe('the registered seat', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Render the registered seat component over one snapshot. */
  function renderSeat(state: DirectoryState, overrides: Record<string, unknown> = {}): string {
    const directory = createDirectory(state)
    return renderToStaticMarkup(
      createElement(Seat, {
        locked: false,
        available: true,
        directory: directory.store,
        load: () => {},
        select: () => Promise.resolve({ ok: true }),
        t,
        ...overrides,
      } as never),
    )
  }

  it('renders the picker when nothing failed', () => {
    const markup = renderSeat(
      emptyState({
        current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
        groups: [demo],
        status: 'ready',
      }),
    )
    expect(markup).toContain('DeepSeek Demo/DeepSeek-V4.1-Flash')
  })

  it('prints the reason when the injected face could not resolve a directory', () => {
    const markup = renderToStaticMarkup(
      createElement(Seat, {
        locked: false,
        available: false,
        failure: 'no model directory for session s1: resolved no scope',
        t,
      } as never),
    )
    expect(markup).toContain('dpmp-crash')
    expect(markup).toContain('picker error: no model directory for session s1: resolved no scope')
  })
})