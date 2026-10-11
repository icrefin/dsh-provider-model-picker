/**
 * Test doubles for the two seams this plugin touches: the client slot registry
 * and the shipped model-directory service.
 *
 * They are deliberately structural — the plugin's own `apply` accepts a
 * structural context, so the doubles exercise the real registration code path
 * without a browser or a running harness.
 *
 * @module dsh-provider-model-picker/test/support
 */

import { vi } from 'vitest'
import type { DirectoryState, Selection } from '../src/client/format.ts'
import type { SelectOutcome } from '../src/client/ModelSelect.tsx'

/** A directory snapshot store plus the verbs the shipped service exposes. */
export interface FakeDirectory {
  /** Observable snapshot the seat injects. */
  readonly store: {
    getSnapshot(): DirectoryState
    subscribe(listener: () => void): () => void
  }
  /** Catalog load, call-counted. */
  readonly load: ReturnType<typeof vi.fn>
  /** Selection submit, call-counted. */
  readonly select: ReturnType<typeof vi.fn>
  /** Publish a new snapshot to subscribers. */
  set(next: DirectoryState): void
}

/** Options one seat registration carried. */
export interface SeatRegistration {
  /** The exact options object handed to `slots.register`. */
  readonly options: {
    readonly name: string
    readonly priority?: number
    readonly locale?: string
    readonly inject?: (sessionId: string) => Record<string, unknown>
  }
  /** The registered component (identity compared, never rendered here). */
  readonly component: unknown
}

/** The fake registry plus everything the assertions need to read. */
export interface FakeHarness {
  /** The context handed to `apply`. */
  readonly ctx: unknown
  /** Live seat registrations, in registration order. */
  readonly registrations: SeatRegistration[]
  /** Service lists passed to `ctx.inject`. */
  readonly injectedServices: string[][]
  /** Slot keys passed to `slots.inject`. */
  readonly injectedSlots: string[]
  /** Locale namespaces registered through `ctx.locale.register`. */
  readonly localeNamespaces: string[]
  /** Effects installed on the context (or on an injected scope). */
  readonly effects: { label: string | undefined; dispose: () => void }[]
  /** The directory handed back for each session id. */
  readonly directories: Map<string, FakeDirectory>
  /** Sessions treated as addressed subagents. */
  readonly subagents: Set<string>
  /** Run every installed disposer. */
  disposeAll(): void
}

/** An empty directory snapshot. */
export function emptyState(overrides: Partial<DirectoryState> = {}): DirectoryState {
  return {
    current: null,
    routable: null,
    groups: [],
    failures: [],
    status: 'idle',
    pending: null,
    error: null,
    ...overrides,
  }
}

/**
 * Build a directory double seeded with one empty snapshot.
 * @param initial - the first snapshot, defaults to an empty idle state.
 * @returns the double, with `load`/`select` as spies.
 */
export function createDirectory(initial: DirectoryState = emptyState()): FakeDirectory {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    store: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    load: vi.fn(() => Promise.resolve(snapshot)),
    select: vi.fn((selection: Selection): Promise<SelectOutcome | undefined> => {
      void selection
      return Promise.resolve({ ok: true })
    }),
    set(next: DirectoryState) {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/**
 * Build a context double that records what the plugin registers.
 * @param options - `occupiedPriorities` simulates a seat already held at that
 * priority; `omitSessions` withholds the session face; `directoryThrows` makes
 * the directory lookup fail the way an unretained session does;
 * `declaredServices` is the plugin's exported `inject` list, which the fake
 * `directoryFor` checks the way cordis does.
 * @returns the harness; call `disposeAll` to run the unload path.
 */
export function createHarness(
  options: {
    occupiedPriorities?: number[]
    omitSessions?: boolean
    directoryThrows?: boolean
    declaredServices?: readonly string[]
  } = {},
): FakeHarness {
  const registrations: SeatRegistration[] = []
  const occupied = new Set(options.occupiedPriorities ?? [])
  const injectedServices: string[][] = []
  const injectedSlots: string[] = []
  const localeNamespaces: string[] = []
  const effects: { label: string | undefined; dispose: () => void }[] = []
  const directories = new Map<string, FakeDirectory>()
  const subagents = new Set<string>()

  const slots = {
    register: (options: SeatRegistration['options'], component: unknown): (() => void) => {
      const priority = options.priority ?? 0
      if (occupied.has(priority)) {
        throw new Error(
          `single slot "${options.name}" already has a registration at priority ${priority}`,
        )
      }
      occupied.add(priority)
      const registration: SeatRegistration = { options, component }
      registrations.push(registration)
      return () => {
        occupied.delete(priority)
        const index = registrations.indexOf(registration)
        if (index >= 0) registrations.splice(index, 1)
      }
    },
    inject: (key: string, callback: () => () => void): (() => void) => {
      injectedSlots.push(key)
      return callback()
    },
  }

  const modelDirectories = {
    directoryFor: (sessionId: string): FakeDirectory => {
      if (options.directoryThrows === true) {
        throw new Error(`ui-model-selection: session "${sessionId}" resolved no scope`)
      }
      // cordis rebinds `this` to the CALLER's context for a service method, and
      // the real resolver constructs a directory from `this.ctx.remote.session`
      // on a cache miss. A caller that did not declare it gets this exact
      // failure, so the double enforces it too.
      if (options.declaredServices !== undefined && !options.declaredServices.includes('remote.session')) {
        throw new Error('cannot get property "remote.session" without inject')
      }
      const existing = directories.get(sessionId)
      if (existing !== undefined) return existing
      const created = createDirectory()
      directories.set(sessionId, created)
      return created
    },
  }

  const sessions = {
    subagentAddress: (sessionId: string): unknown => (subagents.has(sessionId) ? { id: sessionId } : undefined),
  }

  const effect = (callback: () => (() => void) | void, label?: string): void => {
    const disposer = callback()
    effects.push({ label, dispose: disposer === undefined ? () => {} : disposer })
  }

  const ctx = {
    effect,
    slots,
    locale: {
      register: (namespace: string): (() => void) => {
        localeNamespaces.push(namespace)
        return () => {}
      },
      bind: () => (key: string) => key,
    },
    inject: (services: string[], callback: (scope: unknown) => void): void => {
      injectedServices.push([...services])
      callback({
        effect,
        slots,
        modelDirectories,
        ...(options.omitSessions === true ? {} : { sessions }),
      })
    },
  }

  return {
    ctx,
    registrations,
    injectedServices,
    injectedSlots,
    localeNamespaces,
    effects,
    directories,
    subagents,
    disposeAll: () => {
      for (const entry of effects) entry.dispose()
    },
  }
}