/**
 * dsh-provider-model-picker — browser half.
 *
 * The composer's model seat (`conversation.input.model`) is a `single` slot: it
 * holds one occupant, and the slot registry renders the **lowest live
 * `priority`**, keeping the higher entry as the supervised fallback. The
 * shipped picker registers at the default priority 0 and shows the model name
 * alone, so this plugin re-registers the seat at `SHADOW_PRIORITY` with a
 * control that prints `Provider/Model` — and, because shadowing the seat means
 * owning it, the same two-level picker underneath, reading the *same*
 * per-session directory (`ctx.modelDirectories`) the `/model` popup uses.
 *
 * `dsh.client.inject` in `package.json` orders this bundle after the packages
 * that declare the seat and provide the directory service; the `ctx.inject`
 * below additionally waits for both services, so a different activation order
 * cannot race the registration.
 *
 * A plugin must never take the web shell down with it, and this one registers
 * late (when the composer declares its seat) as well as at mount, so both the
 * `apply` body and the registration callback are guarded: a failure logs and
 * leaves the shipped picker in place.
 *
 * @module dsh-provider-model-picker/client
 */

import type { SlotCore, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only import for the declaration merging that puts
// `conversation.input.model` and its owner props into SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { Seat, type SeatResolution, type SelectOutcome } from './ModelSelect.tsx'
import { en, zh } from './locales.ts'
import { injectStyles } from './styles.ts'
import type { DirectoryState, Selection } from './format.ts'

/** Dictionary namespace owned by this plugin. */
export const NS = 'dsh-provider-model-picker'

/** The composer seat this plugin shadows. */
export const SLOT = 'conversation.input.model'

/**
 * The seat's shipped occupant registers at the default priority 0; the registry
 * renders the lowest live priority, so -1 shadows it while leaving the shipped
 * entry registered as the crash fallback.
 */
export const SHADOW_PRIORITY = -1

/**
 * Services required by the registration.
 *
 * The list is not just this plugin's own reads. `ctx.modelDirectories` is a
 * cordis **service proxy**: it rebinds `this.ctx` to the *caller's* context, so
 * `directoryFor()` — which constructs a `ModelDirectory` from
 * `this.ctx.remote.session` on a cache miss — is reading **this** plugin's
 * context. Without `remote` and `remote.session` declared here, the first call
 * for any session whose directory nobody has created yet dies with
 * `cannot get property "remote.session" without inject`.
 *
 * That miss is invisible while another surface (the shipped picker, the `/model`
 * popup) happens to create the directory first, and guaranteed when this entry
 * is first — which, at `priority: -1`, is exactly what happens on a session
 * switch. The shipped picker declares the same two for the same reason.
 */
export const inject = [
  'slots',
  'locale',
  'sessions',
  'modelDirectories',
  'remote',
  'remote.session',
]

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Keys of this plugin's own dictionary. */
    'dsh-provider-model-picker': keyof typeof en
  }
}

/** Structural face of the client locale service. */
interface LocaleService {
  register(namespace: string, dictionaries: { en: typeof en; zh: typeof zh }): () => void
  bind(namespace: string): TranslateNS<typeof NS>
}

/** Structural face of the client slot service. */
interface SlotsService {
  readonly register: SlotCore['register']
  /**
   * Run `callback` once the named slot is declared; the returned disposer is
   * the registration's own disposer, so the effect teardown removes it.
   */
  inject(key: string, callback: () => () => void): () => void
}

/** The observable snapshot store one session's directory publishes. */
interface DirectoryStore {
  getSnapshot(): DirectoryState
  subscribe(listener: () => void): () => void
}

/** One session's shared model directory (owned by the shipped picker). */
interface SessionDirectory {
  /** Snapshot both entries render from. */
  readonly store: DirectoryStore
  /** Load (or refresh) the host's catalog. */
  load(): Promise<unknown>
  /** Submit a complete selection. */
  select(selection: Selection): Promise<SelectOutcome | undefined>
}

/** The `ctx.modelDirectories` service. */
interface ModelDirectoriesService {
  /** Resolve the session's resident directory. */
  directoryFor(sessionId: string): SessionDirectory
}

/** The `ctx.sessions` wire face, used for the addressed-subagent guard. */
interface SessionsService {
  /** Non-undefined when the session is an addressed subagent. */
  subagentAddress(sessionId: string): unknown
}

/** The context handed to the `ctx.inject` callback, with its services bound. */
interface ClientScope {
  effect(callback: () => (() => void) | void, label?: string): void
  slots: SlotsService
  modelDirectories: ModelDirectoriesService
  sessions: SessionsService
}

/** Structural face of the client root context this plugin uses. */
interface ClientContext {
  effect(callback: () => (() => void) | void, label?: string): void
  inject(services: string[], callback: (scope: ClientScope) => void): void
  slots: SlotsService
  locale: LocaleService
}

/**
 * Resolve the seat's face: the shared directory snapshot plus the verbs the
 * shipped control receives, so the same component contract holds.
 *
 * **Nothing in here may throw.** The factory runs inside the renderer, and a
 * throw there retires the seat for the rest of the page's life — silently, since
 * no component of this plugin is mounted yet to catch it. Every step is guarded,
 * and a failure becomes a `failure` message the seat can print while it retries:
 * a session binding that is not ready yet, an unretained session, or a service
 * that answers differently than documented.
 *
 * @param models - the shared model-directory service.
 * @param sessions - the session wire face.
 * @param sessionId - the session that owns the composer.
 * @returns the resolved face, or the reason it could not be resolved.
 */
function resolveSeat(
  models: ModelDirectoriesService,
  sessions: SessionsService | undefined,
  sessionId: string,
): SeatResolution {
  try {
    const directory = models.directoryFor(sessionId)
    const available = sessions?.subagentAddress?.(sessionId) === undefined
    return {
      available,
      directory: directory.store,
      load: () => {
        if (available) directory.load().catch(() => undefined)
      },
      select: (selection) =>
        available ? directory.select(selection) : Promise.resolve(undefined),
    }
  } catch (error) {
    console.error('[dsh-provider-model-picker] the seat could not be wired:', error)
    return {
      available: false,
      failure: `session ${String(sessionId)}: ${describeFailure(error)}`,
    }
  }
}

/**
 * Render one wiring failure as a short single-line string.
 * @param error - the thrown value.
 * @returns `name: message`, or the value's string form.
 */
function describeFailure(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/**
 * Register the dictionaries and shadow the composer's model seat.
 *
 * @param ctx - client root context carrying the slot and locale services.
 */
export function apply(ctx: ClientContext): void {
  try {
    ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-provider-model-picker: dictionaries')

    ctx.inject(['slots', 'modelDirectories', 'sessions', 'remote', 'remote.session'], (scope) => {
      const models = scope.modelDirectories
      const sessions = scope.sessions
      scope.effect(
        () =>
          scope.slots.inject(SLOT, () => {
            try {
              const dispose = scope.slots.register(
                {
                  name: SLOT,
                  priority: SHADOW_PRIORITY,
                  locale: NS,
                  // The frame works caches injected props per session binding, so
                  // the seat gets a re-runnable thunk rather than one snapshot of
                  // the resolution: a binding that is not ready yet repairs itself
                  // instead of retiring the entry.
                  inject: (sessionId: string) => ({
                    resolve: () => resolveSeat(models, sessions, sessionId),
                  }),
                },
                Seat,
              )
              // One breadcrumb: this plugin replaces shipped UI, so "which
              // picker am I looking at?" should be answerable from the console.
              console.info(
                `[dsh-provider-model-picker] shadowed "${SLOT}" at priority ${SHADOW_PRIORITY}`,
              )
              return dispose
            } catch (error) {
              // Another occupant already holds this priority: keep the shipped
              // picker rather than breaking the composer's own registration.
              console.warn(
                '[dsh-provider-model-picker] the model seat could not be shadowed',
                error,
              )
              return () => {}
            }
          }),
        'dsh-provider-model-picker: model seat',
      )
    })
  } catch (error) {
    console.warn('[dsh-provider-model-picker] the picker could not mount', error)
  }
}

// Materialization runs this: the client module system claims a style tag created
// from the bundle's factory body and removes it again when the plugin unloads.
injectStyles()