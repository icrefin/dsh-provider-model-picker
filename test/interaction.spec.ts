// @vitest-environment jsdom
/**
 * The picker's interaction path, in a DOM.
 *
 * The trigger label is the plugin's point, but shadowing the seat means owning
 * its menu too — so these drive the real component: open, drill into the model
 * list, pick a row, pick an effort, search, and close. Assertions read the
 * selection handed to `select()`, which is what the host would apply.
 *
 * @module dsh-provider-model-picker/test/interaction
 */

import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderModelSelect, Seat } from '../src/client/ModelSelect.tsx'
import { en } from '../src/client/locales.ts'
import { createDirectory, emptyState, type FakeDirectory } from './support.ts'
import type { DirectoryState, ProviderGroup, Selection } from '../src/client/format.ts'
import type { SelectOutcome } from '../src/client/ModelSelect.tsx'

const account: ProviderGroup = {
  id: 'deepseek-account',
  name: 'DeepSeek Account',
  models: [{ id: 'deepseek-chat', name: 'DeepSeek-V3.2' }],
}

const demo: ProviderGroup = {
  id: 'deepseek-demo',
  name: 'DeepSeek Demo',
  models: [
    { id: 'deepseek-v4.1-flash', name: 'DeepSeek-V4.1-Flash' },
    {
      id: 'deepseek-v4.1-pro',
      name: 'DeepSeek-V4.1-Pro',
      reasoning: {
        defaultEffort: 'high',
        efforts: [
          { id: 'low', name: 'Low' },
          { id: 'high', name: 'High' },
        ],
      },
    },
    // The search field only appears past four choices, as in the shipped picker.
    { id: 'deepseek-v4.1-tiny', name: 'DeepSeek-V4.1-Tiny' },
    { id: 'deepseek-v4.1-base', name: 'DeepSeek-V4.1-Base' },
    { id: 'deepseek-v4.1-lite', name: 'DeepSeek-V4.1-Lite' },
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

/** A mounted component plus the spies its props hand out. */
interface Mounted {
  readonly container: HTMLElement
  readonly directory: FakeDirectory
  readonly select: ReturnType<typeof vi.fn>
  readonly load: ReturnType<typeof vi.fn>
  readonly unmount: () => void
}

let root: Root | null = null
let mounted: Mounted | null = null

/**
 * Mount the seat over one directory snapshot.
 * @param state - the snapshot to publish.
 * @param overrides - prop overrides such as `locked` or `available`.
 * @returns the mount handles.
 */
function mount(
  state: DirectoryState,
  overrides: Partial<Parameters<typeof ProviderModelSelect>[0]> = {},
): Mounted {
  const directory = createDirectory(state)
  // The host answers a selection by rewriting the projected selection, so the
  // double publishes the new current value too — that is what re-renders the
  // trigger in the real client.
  const select = vi.fn(
    (selection: Selection): Promise<SelectOutcome> => {
      directory.set({ ...directory.store.getSnapshot(), current: selection })
      return Promise.resolve({ ok: true })
    },
  )
  const load = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      createElement(ProviderModelSelect, {
        locked: false,
        available: true,
        directory: directory.store,
        load,
        select,
        t,
        ...overrides,
      }),
    )
  })
  mounted = { container, directory, select, load, unmount: () => root?.unmount(), }
  return mounted
}

/** The trigger button. */
function trigger(): HTMLButtonElement {
  const button = mounted!.container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
  expect(button).not.toBeNull()
  return button!
}

/** The portalled menu surface, if open. */
function menu(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="menu"]')
}

/** Every row inside the open menu. */
function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')]
}

/**
 * Find a row by its visible text.
 * @param text - exact text content to match.
 * @returns the row.
 */
function rowByText(text: string): HTMLElement {
  const row = rows().find((candidate) => candidate.textContent === text)
  expect(row, `row "${text}" in ${JSON.stringify(rows().map((r) => r.textContent))}`).toBeDefined()
  return row!
}

/** Click an element inside `act`. */
function click(element: HTMLElement): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/** Press a key on an element inside `act`. */
function press(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

/**
 * Press a key on whatever currently holds focus — the trigger, or a row inside
 * the portalled menu, which reaches the seat's handler through the React tree.
 * @param key - the key to press.
 */
function pressActive(key: string): void {
  press(document.activeElement instanceof HTMLElement ? document.activeElement : trigger(), key)
}

const readyState: DirectoryState = emptyState({
  current: { provider: 'deepseek-account', model: 'deepseek-chat' },
  groups: [account, demo],
  status: 'ready',
})

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => {
    mounted?.unmount()
  })
  mounted?.container.remove()
  root = null
  mounted = null
  vi.restoreAllMocks()
})

describe('opening the picker', () => {
  it('shows the provider-qualified label on the trigger and no menu at rest', () => {
    mount(readyState)
    expect(trigger().textContent).toContain('DeepSeek Account/DeepSeek-V3.2')
    expect(menu()).toBeNull()
  })

  it('opens the root cells and loads the catalog', () => {
    mount(readyState)
    click(trigger())
    expect(menu()).not.toBeNull()
    expect(rowByText('ModelDeepSeek Account/DeepSeek-V3.2')).toBeDefined()
    expect(mounted!.load).toHaveBeenCalledTimes(1)
  })

  it('lists every provider group with its models after drilling into Model', () => {
    mount(readyState)
    click(trigger())
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))

    const headings = [...document.querySelectorAll<HTMLElement>('.dpmp-heading')].map(
      (node) => node.textContent,
    )
    expect(headings).toEqual(['DeepSeek Account', 'DeepSeek Demo'])
    expect(rowByText('DeepSeek-V4.1-Flash')).toBeDefined()
    expect(rowByText('DeepSeek-V3.2')).toBeDefined()
  })
})

describe('choosing a model', () => {
  it('submits the provider-qualified selection and closes', async () => {
    mount(readyState)
    click(trigger())
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))
    await act(async () => {
      click(rowByText('DeepSeek-V4.1-Flash'))
    })

    expect(mounted!.select).toHaveBeenCalledWith({
      provider: 'deepseek-demo',
      model: 'deepseek-v4.1-flash',
    })
    expect(menu()).toBeNull()
    expect(mounted!.container.querySelector<HTMLButtonElement>('button')!.textContent).toContain(
      'DeepSeek Demo/DeepSeek-V4.1-Flash',
    )
  })

  it('carries the model default effort when the adapter advertises one', async () => {
    mount(readyState)
    click(trigger())
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))
    await act(async () => {
      click(rowByText('DeepSeek-V4.1-Pro'))
    })

    expect(mounted!.select).toHaveBeenCalledWith({
      provider: 'deepseek-demo',
      model: 'deepseek-v4.1-pro',
      reasoningEffort: 'high',
    })
  })

  it('closes without submitting when the current model is re-picked', () => {
    mount(readyState)
    click(trigger())
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))
    click(rowByText('DeepSeek-V3.2'))

    expect(mounted!.select).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
  })

  it('announces a rejected selection inside the menu and keeps it open', async () => {
    mount(readyState)
    mounted!.select.mockResolvedValueOnce({
      ok: false,
      error: { code: 'session/writer-held', message: 'held' },
    })
    click(trigger())
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))
    await act(async () => {
      click(rowByText('DeepSeek-V4.1-Flash'))
    })

    expect(menu()).not.toBeNull()
    expect(document.querySelector('.dpmp-error')?.textContent).toContain('already in use')
  })
})

describe('choosing a reasoning effort', () => {
  it('keeps the model and submits only the effort', async () => {
    mount(
      emptyState({
        current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-pro', reasoningEffort: 'high' },
        groups: [account, demo],
        status: 'ready',
      }),
    )
    click(trigger())
    click(rowByText('EffortHigh'))
    await act(async () => {
      click(rowByText('Low'))
    })

    expect(mounted!.select).toHaveBeenCalledWith({
      provider: 'deepseek-demo',
      model: 'deepseek-v4.1-pro',
      reasoningEffort: 'low',
    })
  })

  it('hides the effort cell for a model without reasoning metadata', () => {
    mount(
      emptyState({
        current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
        groups: [account, demo],
        status: 'ready',
      }),
    )
    click(trigger())
    expect(rows().map((row) => row.textContent)).toEqual(['ModelDeepSeek Demo/DeepSeek-V4.1-Flash'])
  })
})

describe('search and keyboard', () => {
  it('filters the model list by the typed query', () => {
    mount(readyState)
    click(trigger())
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))

    const search = document.querySelector<HTMLInputElement>('input[type="text"]')
    expect(search).not.toBeNull()
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(search, 'flash')
      search!.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(rows().map((row) => row.textContent)).toEqual(['DeepSeek-V4.1-Flash'])
  })

  it('closes on Escape and returns focus to the trigger', () => {
    mount(readyState)
    click(trigger())
    pressActive('Escape')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('walks back from a drilled pane before closing', () => {
    mount(readyState)
    click(trigger())
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))
    pressActive('Escape')
    expect(rows()[0]?.textContent).toContain('Model')
    pressActive('Escape')
    expect(menu()).toBeNull()
  })

  it('moves focus into the menu with the arrow keys', () => {
    mount(readyState)
    click(trigger())
    trigger().focus()

    // From the trigger, ArrowDown lands on the first root cell and wraps back.
    pressActive('ArrowDown')
    expect(document.activeElement).toBe(rows()[0])
    pressActive('ArrowUp')
    expect(document.activeElement).toBe(rows()[rows().length - 1])

    // Inside the drilled model pane the arrows walk the model rows in order.
    click(rowByText('ModelDeepSeek Account/DeepSeek-V3.2'))
    const list = rows()
    expect(list.length).toBeGreaterThan(2)
    expect(document.activeElement).toBe(document.querySelector('input[type="text"]'))

    pressActive('ArrowDown')
    expect(document.activeElement).toBe(list[0])
    press(list[0]!, 'ArrowDown')
    expect(document.activeElement).toBe(list[1])
    press(list[1]!, 'ArrowUp')
    expect(document.activeElement).toBe(list[0])
  })
})

describe('unavailable and locked states', () => {
  it('renders nothing for an addressed subagent session', () => {
    const view = mount(readyState, { available: false })
    expect(view.container.innerHTML).toBe('')
  })

  it('disables the trigger while the composer is locked', () => {
    mount(readyState, { locked: true })
    expect(trigger().disabled).toBe(true)
  })

  it('shows the loading copy while the directory is still loading', () => {
    mount(emptyState({ status: 'loading' }))
    expect(trigger().textContent).toContain('Loading models…')
  })
})

describe('failure reporting', () => {
  /** Mount any element into a fresh container and remember it for teardown. */
  function mountElement(element: ReactElement): HTMLElement {
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => {
      root!.render(element)
    })
    mounted = {
      container,
      directory: createDirectory(emptyState()),
      select: vi.fn(),
      load: vi.fn(),
      unmount: () => root?.unmount(),
    }
    return container
  }

  it('keeps rendering when the directory store itself refuses to be read', () => {
    // A session scope torn down mid-switch is the realistic way to get here.
    // This must degrade to the idle state, not throw — a throw inside the
    // renderer retires the entry for every session, not just this one.
    const container = mountElement(
      createElement(Seat, {
        locked: false,
        available: true,
        directory: {
          getSnapshot: (): DirectoryState => {
            throw new Error('snapshot exploded')
          },
          subscribe: () => {
            throw new Error('subscribe exploded')
          },
        },
        load: () => {},
        select: () => Promise.resolve({ ok: true }),
        t,
      } as never),
    )

    expect(container.querySelector('.dpmp-crash')).toBeNull()
    expect(container.textContent).toContain('Select model')
  })

  it('catches a crashing child and keeps the reason in the composer', () => {
    const exploding = (key: string): string => {
      if (key === 'provider.account') throw new Error('t exploded')
      return t(key as never)
    }
    const container = mountElement(
      createElement(Seat, {
        locked: false,
        available: true,
        directory: createDirectory(emptyState()).store,
        load: () => {},
        select: () => Promise.resolve({ ok: true }),
        t: exploding,
      } as never),
    )

    const chip = container.querySelector('.dpmp-crash')
    expect(chip).not.toBeNull()
    expect(chip!.textContent).toContain('Error: t exploded')
    expect(chip!.getAttribute('role')).toBe('alert')
  })

  it('prints the reason when the seat was handed a failure instead of a directory', () => {
    const container = mountElement(
      createElement(Seat, {
        locked: false,
        available: false,
        failure: 'no model directory for session s1: resolved no scope',
        t,
      } as never),
    )
    expect(container.querySelector('.dpmp-crash')?.textContent).toContain('resolved no scope')
  })

  it('repairs a transient wiring failure by itself and then renders the picker', async () => {
    // The frame works caches injected props per session binding, so a binding
    // that is not ready yet used to retire the seat for the rest of the page.
    const directory = createDirectory(readyState)
    let attempts = 0
    const resolve = (): Record<string, unknown> => {
      attempts += 1
      return attempts === 1
        ? { available: false, failure: 'session s1: Error: resolved no scope' }
        : {
            available: true,
            directory: directory.store,
            load: () => {},
            select: () => Promise.resolve({ ok: true }),
          }
    }
    const container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => {
      root!.render(createElement(Seat, { locked: false, t, resolve } as never))
    })
    mounted = { container, directory, select: vi.fn(), load: vi.fn(), unmount: () => root?.unmount() }

    expect(container.querySelector('.dpmp-crash')).not.toBeNull()

    // The seat retries once a second.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_200))
    })

    expect(attempts).toBeGreaterThan(1)
    expect(container.querySelector('.dpmp-crash')).toBeNull()
    expect(container.textContent).toContain('DeepSeek Account/DeepSeek-V3.2')
  })
})