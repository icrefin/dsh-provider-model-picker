/**
 * The seat registration, driven through the plugin's real `apply`.
 *
 * What this proves: the plugin shadows `conversation.input.model` at a lower
 * priority than the shipped occupant, threads the session's model directory
 * into the seat's props, and gives the registration back on unload. What it
 * cannot prove: that the browser renders it — that needs the live GUI.
 *
 * @module dsh-provider-model-picker/test/seat
 */

import { describe, expect, it, vi } from 'vitest'
import { NS, SHADOW_PRIORITY, SLOT, apply, inject } from '../src/client/index.tsx'
import { Seat, type SeatResolution } from '../src/client/ModelSelect.tsx'
import { createHarness, emptyState } from './support.ts'
import type { DirectoryState, Selection } from '../src/client/format.ts'

/** Mount the plugin against one harness context. */
function mount(harness: ReturnType<typeof createHarness>): void {
  apply(harness.ctx as Parameters<typeof apply>[0])
}

/**
 * A harness whose directory service enforces the cordis rule the real one has:
 * the service proxy rebinds `this` to the caller, so the caller's own `inject`
 * declaration decides whether `remote.session` is reachable.
 */
function harnessWithDeclarationCheck() {
  return createHarness({ declaredServices: inject })
}

/**
 * Resolve the seat's face for one session through the registration's wiring
 * thunk — the same call the seat component makes while it retries.
 * @param harness - the harness that mounted the plugin.
 * @param sessionId - the session to wire.
 * @returns the resolved face.
 */
function faceFor(harness: ReturnType<typeof createHarness>, sessionId: string) {
  const face = registeredOptions(harness).inject!(sessionId) as { resolve: () => SeatResolution }
  expect(typeof face.resolve).toBe('function')
  return face.resolve()
}

/** The seat options the plugin registered, asserted non-optional. */
function registeredOptions(harness: ReturnType<typeof createHarness>) {
  const registration = harness.registrations[0]
  expect(registration).toBeDefined()
  return registration!.options
}

describe('plugin surface', () => {
  it('declares every service it reads, including the caller-side ones the service proxy needs', () => {
    // `remote.session` is not read by this plugin directly: the model-directory
    // resolver reads it through the CALLER's context when it builds a session's
    // directory. Without it, the first call for an unwarmed session throws
    // `cannot get property "remote.session" without inject` — which is exactly
    // what happens on a session switch, where this entry (priority -1) renders
    // before the shipped picker can warm the cache.
    expect(inject).toEqual([
      'slots',
      'locale',
      'sessions',
      'modelDirectories',
      'remote',
      'remote.session',
    ])
  })

  it('addresses the composer model seat with a lower priority than the shipped occupant', () => {
    expect(SLOT).toBe('conversation.input.model')
    expect(SHADOW_PRIORITY).toBeLessThan(0)
  })
})

describe('apply', () => {
  it('registers its dictionaries under its own namespace', () => {
    const harness = createHarness()
    mount(harness)

    expect(harness.localeNamespaces).toEqual([NS])
    expect(harness.effects[0]?.label).toBe('dsh-provider-model-picker: dictionaries')
  })

  it('waits for the slot registry, the model directory and the session face', () => {
    const harness = createHarness()
    mount(harness)

    expect(harness.injectedServices).toEqual([
      ['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session'],
    ])
    expect(harness.injectedSlots).toEqual([SLOT])
  })

  it('leaves a console breadcrumb naming the slot it shadowed', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      mount(createHarness())
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining(`shadowed "${SLOT}" at priority ${SHADOW_PRIORITY}`),
      )
    } finally {
      info.mockRestore()
    }
  })

  it('shadows the seat with its own component, its own locale and the shadow priority', () => {
    const harness = createHarness()
    mount(harness)

    const options = registeredOptions(harness)
    expect(options.name).toBe(SLOT)
    expect(options.priority).toBe(SHADOW_PRIORITY)
    expect(options.locale).toBe(NS)
    expect(harness.registrations[0]?.component).toBe(Seat)
  })

  it('hands the seat the session directory and the selection verbs', async () => {
    const harness = harnessWithDeclarationCheck()
    mount(harness)
    const face = faceFor(harness, 'session-1')

    expect(face.available).toBe(true)
    expect(face.directory).toBe(harness.directories.get('session-1')?.store)

    ;(face.load as () => void)()
    expect(harness.directories.get('session-1')?.load).toHaveBeenCalledTimes(1)

    const selection: Selection = { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' }
    await (face.select as (value: Selection) => Promise<unknown>)(selection)
    expect(harness.directories.get('session-1')?.select).toHaveBeenCalledWith(selection)
  })

  it('keeps one directory per session across repeat reads', () => {
    const harness = harnessWithDeclarationCheck()
    mount(harness)
    expect(faceFor(harness, 'session-1').directory).toBe(faceFor(harness, 'session-1').directory)
    expect(harness.directories.size).toBe(1)
  })

  it('exposes no verbs on an addressed subagent session', async () => {
    const harness = createHarness()
    harness.subagents.add('sub-1')
    mount(harness)
    const face = faceFor(harness, 'sub-1')

    expect(face.available).toBe(false)
    ;(face.load as () => void)()
    expect(harness.directories.get('sub-1')?.load).not.toHaveBeenCalled()
    await expect(
      (face.select as (value: Selection) => Promise<unknown>)({
        provider: 'deepseek-demo',
        model: 'deepseek-v4.1-flash',
      }),
    ).resolves.toBeUndefined()
    expect(harness.directories.get('sub-1')?.select).not.toHaveBeenCalled()
  })

  it('swallows a catalog load failure instead of surfacing an unhandled rejection', async () => {
    const harness = createHarness()
    mount(harness)
    const face = faceFor(harness, 'session-1')
    const directory = harness.directories.get('session-1')!
    directory.load.mockImplementationOnce(() => Promise.reject(new Error('host offline')))

    expect(() => (face.load as () => void)()).not.toThrow()
    await Promise.resolve()
  })

  it('still wires the seat when the session face is missing', () => {
    const harness = createHarness({ omitSessions: true })
    mount(harness)
    const face = faceFor(harness, 'session-1')

    // Without the session face the seat cannot tell a subagent apart, so it
    // must assume an ordinary session rather than throwing during render.
    expect(face.available).toBe(true)
    ;(face.load as () => void)()
    expect(harness.directories.get('session-1')?.load).toHaveBeenCalledTimes(1)
  })

  it('reports a failed directory lookup instead of throwing inside the renderer', () => {
    const harness = createHarness({ directoryThrows: true })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mount(harness)
      expect(() => faceFor(harness, 'session-1')).not.toThrow()
      const face = faceFor(harness, 'session-1')
      expect(face.available).toBe(false)
      expect(face.directory).toBeUndefined()
      expect(String(face.failure)).toContain('resolved no scope')
      expect(error).toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })

  it('drops the registration when the effect tears down', () => {
    const harness = createHarness()
    mount(harness)
    expect(harness.registrations).toHaveLength(1)
    expect(harness.effects[1]?.label).toBe('dsh-provider-model-picker: model seat')

    harness.disposeAll()
    expect(harness.registrations).toHaveLength(0)
  })

  it('leaves the shipped picker in place when the priority is already taken', () => {
    const harness = createHarness({ occupiedPriorities: [SHADOW_PRIORITY] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => mount(harness)).not.toThrow()
      expect(harness.registrations).toHaveLength(0)
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('survives a service that never becomes available', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const harness = createHarness()
      const ctx = harness.ctx as { inject: (...args: unknown[]) => void }
      ctx.inject = () => {
        throw new Error('modelDirectories is not available')
      }
      expect(() => mount(harness)).not.toThrow()
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('injected directory snapshot', () => {
  it('publishes host changes to the seat without any extra fetch', () => {
    const harness = createHarness()
    mount(harness)
    const face = faceFor(harness, 'session-1')
    const store = face.directory as {
      getSnapshot(): DirectoryState
      subscribe(listener: () => void): () => void
    }

    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    harness.directories.get('session-1')?.set(emptyState({ status: 'ready' }))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().status).toBe('ready')

    unsubscribe()
    harness.directories.get('session-1')?.set(emptyState({ status: 'error' }))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})