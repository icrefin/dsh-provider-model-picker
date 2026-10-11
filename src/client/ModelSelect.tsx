/**
 * The composer's model seat, re-registered to name the provider.
 *
 * The shipped seat (`@deepseek-ai/dsh-client-ui-model-selection`) renders the
 * model alone — `currentChoice.model.name`. This component registers into the
 * same seat at a lower `priority`, which shadows that entry (the slot registry
 * renders the lowest live priority and keeps the higher one as the supervised
 * fallback if this one crashes), and prints `Provider/Model` in the trigger
 * instead: `DeepSeek Demo/DeepSeek-V4.1-Flash`.
 *
 * Everything below the trigger is the same two-level picker over the *same*
 * per-session directory instance the `/model` popup uses, so a switch made here
 * is what `/model` shows next. The markup and CSS are this plugin's own,
 * modelled on the shipped control's — no host UI package is imported, because a
 * renamed primitive would blank the seat.
 *
 * @module dsh-provider-model-picker/client/ModelSelect
 */

import { Component, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  carries,
  choiceOf,
  effortLabel,
  effortRows,
  fill,
  modelChoices,
  modelLabel,
  orderProviders,
  providerLabel,
  selectionFor,
  triggerAria,
  type DirectoryState,
  type LabelCopy,
  type ModelChoice,
  type Selection,
} from './format.ts'
import type { Translate } from './locales.ts'
import { rankModels } from './rank.ts'
import { CSS } from './styles.ts'

/** The observable directory snapshot the seat injects. */
export interface DirectorySnapshotSource {
  /** Read the current snapshot. */
  getSnapshot(): DirectoryState
  /** Subscribe to snapshot changes. */
  subscribe(listener: () => void): () => void
}

/** Outcome of a selection, as the directory reports it. */
export interface SelectOutcome {
  /** Whether the host accepted the selection. */
  readonly ok: boolean
  /** The remote failure, when it did not. */
  readonly error?: { readonly code: string; readonly message: string } | undefined
}

/** One session's resolved directory face, or the reason it could not be wired. */
export interface SeatResolution {
  /** Whether this session may use Agent-bound model RPCs. */
  readonly available?: boolean
  /** The session's shared model directory snapshot. */
  readonly directory?: DirectorySnapshotSource
  /** Kick off a catalog load. */
  readonly load?: () => void
  /** Submit a complete selection. */
  readonly select?: (selection: Selection) => Promise<SelectOutcome | undefined>
  /** Why the seat cannot work at all, when the wiring failed. */
  readonly failure?: string
}

/**
 * Props the seat's owner and this plugin's injection face supply.
 *
 * `resolve` is the live wiring thunk: the frame works caches injected props per
 * session binding, so the seat keeps the ability to re-run the lookup.
 */
export interface SeatProps {
  /** Whether the composer currently refuses interaction. */
  locked: boolean
  /** Translate seat bound to this plugin's namespace. */
  t: Translate
  /** Re-run the session wiring; the seat retries while it reports a failure. */
  resolve?: (() => SeatResolution) | undefined
  /** A resolution passed directly, instead of through `resolve`. */
  available?: boolean
  directory?: DirectorySnapshotSource | undefined
  load?: (() => void) | undefined
  select?: ((selection: Selection) => Promise<SelectOutcome | undefined>) | undefined
  failure?: string | undefined
}

/**
 * How many times a failed seat re-runs its wiring, and how often. A binding
 * that is not ready yet usually answers on the next tick.
 */
const SEAT_RETRY_MS = 1_000

/** Retry budget for {@link SEAT_RETRY_MS}. */
const SEAT_RETRIES = 10

/**
 * The snapshot rendered when a directory store cannot be read at all.
 *
 * Frozen and module-level on purpose: `useSyncExternalStore` requires a cached
 * value, and a fresh object per call would make React loop. A session scope torn
 * down mid-switch is the realistic way to get here, and showing the idle state
 * for that instant is better than throwing — a throw retires the whole seat.
 */
const UNREADABLE_STATE: DirectoryState = Object.freeze({
  current: null,
  routable: null,
  groups: [],
  failures: [],
  status: 'idle',
  pending: null,
  error: null,
})

/** Which pane the menu shows. */
type Pane = 'root' | 'model' | 'effort'

/** What the next render should focus, consumed once by the focus effect. */
type FocusRequest = 'search' | 'row' | 'cell0' | 'cell1' | null

/** Unplaced portal card: hidden but laid out at a fixed origin so the measure pass is real. */
const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 } as const

/** Viewport margin kept around the menu. */
const MARGIN = 12

/**
 * Join class names, ignoring falsy entries.
 * @param parts - candidate class names.
 * @returns the joined class attribute value.
 */
function cx(...parts: (string | false | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ')
}

/** The compact glyph the composer shows when the model text does not fit. */
function IconModel({ size = 16, className }: { size?: number; className?: string }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="8" cy="4.4" rx="4.75" ry="1.9" />
      <path d="M3.25 4.4v3.6c0 1.05 2.13 1.9 4.75 1.9s4.75-.85 4.75-1.9V4.4" />
      <path d="M3.25 8v3.6c0 1.05 2.13 1.9 4.75 1.9s4.75-.85 4.75-1.9V8" />
    </svg>
  )
}

/** Chevron-down glyph for the trigger. */
function IconChevronDown({ className }: { className?: string }): ReactElement {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.75 4.5 6 7.75l3.25-3.25" />
    </svg>
  )
}

/** Chevron-right glyph for the root cells. */
function IconChevronRight({ className }: { className?: string }): ReactElement {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 2.75 7.75 6 4.5 9.25" />
    </svg>
  )
}

/** Check glyph for the selected row. */
function IconCheck(): ReactElement {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.75 7.5 5.5 10.25 11.25 4" />
    </svg>
  )
}

/** The in-flight mark that replaces a check or the trigger's chevron. */
function Spinner(): ReactElement {
  return (
    <svg className={CSS.spinner} width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <circle className={CSS.spinnerTrack} cx="7" cy="7" r="5.4" />
      <path className={CSS.spinnerArc} d="M7 1.6a5.4 5.4 0 0 1 5.4 5.4" />
    </svg>
  )
}

/**
 * Render one error as a short single-line string.
 * @param error - the thrown value.
 * @returns `name: message`, or the value's string form.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/**
 * The seat's failure face: prints why the control is unavailable and offers the
 * way out.
 *
 * Retiring is the point: the slot registry re-renders the cell onto the shipped
 * picker once this entry throws, which is the fallback this plugin promises. The
 * user chooses when — the message does not time out, because a reason that
 * disappears after a few seconds is one nobody can act on.
 *
 * @param props - the message and the translate seat.
 * @returns the visible failure chip.
 */
function SeatFailure({ text, t }: { text: string; t: Translate }): ReactElement {
  const [retire, setRetire] = useState(false)
  if (retire) throw new Error(`dsh-provider-model-picker: ${text}`)
  return (
    <button
      type="button"
      className={CSS.crash}
      role="alert"
      title={text}
      onClick={() => {
        setRetire(true)
      }}
    >
      {`${t('failure.label')}: ${text} — ${t('failure.handBack')}`}
    </button>
  )
}

/** Boundary state: the caught message, if any. */
interface SeatBoundaryState {
  /** Message shown in place of the picker, null before any crash. */
  message: string | null
}

/**
 * Contain a crash inside this seat's own subtree.
 *
 * The renderer already retires a crashing entry, but it only reports to the
 * page console — which is invisible to a user who cannot open developer tools.
 * This boundary prints the same reason in the seat instead; retiring then waits
 * for the user to click the message, so the reason cannot scroll past unnoticed.
 */
class SeatBoundary extends Component<{ children: ReactNode; t: Translate }, SeatBoundaryState> {
  override state: SeatBoundaryState = { message: null }

  /** Capture the crash so the message can be rendered. */
  static getDerivedStateFromError(error: unknown): SeatBoundaryState {
    return { message: describeError(error) }
  }

  /** Report the crash once, with the plugin named for the console. */
  override componentDidCatch(error: unknown): void {
    console.error('[dsh-provider-model-picker] the composer model seat failed to render:', error)
  }

  /** Show the message until the user hands the cell back. */
  override render(): ReactNode {
    const { message } = this.state
    if (message !== null) return <SeatFailure text={message} t={this.props.t} />
    return this.props.children
  }
}

/**
 * The registered seat component.
 *
 * The framework caches an entry's injected props **once per session binding**,
 * so a binding that was not ready at that instant would otherwise stay broken
 * for the life of the page. `resolve` re-runs the wiring on demand, and the seat
 * retries it while it reports a failure: a transient miss repairs itself within
 * a second, and a permanent one keeps the reason on screen.
 *
 * Hooks run before every conditional return, as the rules require — they are all
 * at the top, unconditionally.
 *
 * @param props - owner share, the wiring thunk, and the locale seat.
 * @returns the picker, its failure chip, or nothing for an addressed subagent.
 */
export function Seat(props: SeatProps): ReactElement | null {
  const [attempt, setAttempt] = useState(0)
  const resolved = useMemo<SeatResolution>(() => {
    if (props.resolve !== undefined) return props.resolve()
    return {
      available: props.available ?? true,
      ...(props.directory === undefined ? {} : { directory: props.directory }),
      ...(props.load === undefined ? {} : { load: props.load }),
      ...(props.select === undefined ? {} : { select: props.select }),
      ...(props.failure === undefined ? {} : { failure: props.failure }),
    }
    // Deliberately keyed on the wiring pieces, not on the props object: the
    // frame works hands a fresh object every render, and re-running the
    // directory lookup for unrelated re-renders is how a teardown race turns
    // into a crash.
  }, [
    props.resolve,
    props.available,
    props.directory,
    props.load,
    props.select,
    props.failure,
    attempt,
  ])
  const failed = resolved.failure !== undefined
  useEffect(() => {
    if (!failed || attempt >= SEAT_RETRIES) return
    const timer = setTimeout(() => {
      setAttempt((previous) => previous + 1)
    }, SEAT_RETRY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [failed, attempt])
  if (failed) return <SeatFailure text={resolved.failure ?? 'unknown'} t={props.t} />
  if (
    resolved.directory === undefined ||
    resolved.load === undefined ||
    resolved.select === undefined
  ) {
    return null
  }
  return (
    <SeatBoundary t={props.t}>
      <ProviderModelSelect
        locked={props.locked}
        t={props.t}
        available={resolved.available ?? true}
        directory={resolved.directory}
        load={resolved.load}
        select={resolved.select}
      />
    </SeatBoundary>
  )
}

/**
 * Props the picker itself needs: a resolved directory face. {@link Seat} owns
 * the resolution and the failure face; this component assumes both succeeded.
 */
export interface ProviderModelSelectProps {
  /** Whether the composer currently refuses interaction. */
  locked: boolean
  /** Whether this session may use Agent-bound model RPCs. */
  available: boolean
  /** The session's shared model directory snapshot. */
  directory: DirectorySnapshotSource
  /** Kick off a catalog load. */
  load: () => void
  /** Submit a complete selection. */
  select: (selection: Selection) => Promise<SelectOutcome | undefined>
  /** Translate seat bound to this plugin's namespace. */
  t: Translate
}

/**
 * Render the composer model seat with its provider named in the trigger.
 * @param props - owner share (`locked`), the directory face, and the locale seat.
 * @returns the trigger and, while open, the two-level picker.
 */
export function ProviderModelSelect({
  locked,
  available,
  directory,
  load,
  select,
  t,
}: ProviderModelSelectProps): ReactElement | null {
  const state = useSyncExternalStore(
    // A directory store whose session scope is being torn down (a switch) can
    // refuse both calls. Neither may throw: a throw here happens inside the
    // renderer and retires the seat for every session, not just this one.
    useCallback(
      (notify: () => void) => {
        try {
          return directory.subscribe(notify)
        } catch {
          return () => {}
        }
      },
      [directory],
    ),
    useCallback(() => {
      try {
        return directory.getSnapshot()
      } catch {
        return UNREADABLE_STATE
      }
    }, [directory]),
    // The web client renders on the client only; the third argument keeps the
    // component renderable by a static renderer (used by this plugin's tests).
    useCallback(() => {
      try {
        return directory.getSnapshot()
      } catch {
        return UNREADABLE_STATE
      }
    }, [directory]),
  )
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>('root')
  const [query, setQuery] = useState('')
  const [selectionFocus, setSelectionFocus] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const focusRequest = useRef<FocusRequest>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const id = useId()

  const copy: LabelCopy = useMemo(
    () => ({
      account: t('provider.account'),
      loading: t('trigger.loading'),
      fallback: t('trigger.fallback'),
      providerDefault: t('effort.providerDefault'),
    }),
    [t],
  )

  const groups = useMemo(() => orderProviders(state.groups), [state.groups])
  const choices = useMemo(() => modelChoices(state.groups), [state.groups])
  // The catalogue crosses a plugin boundary; a shape this build did not expect
  // must degrade to an empty list rather than throw inside the renderer.
  const failures = Array.isArray(state.failures) ? state.failures : []
  const currentChoice = choiceOf(choices, state.current)
  const reasoning = currentChoice?.model.reasoning
  const label = modelLabel(state, copy)
  const effort = effortLabel(state, copy)
  const busy = state.pending !== null
  const showSearch = choices.length > 4

  const visibleGroups = useMemo(() => {
    const ranked = groups.map((group) => ({
      group,
      models: rankModels(group.models, showSearch ? query : ''),
    }))
    return ranked.filter((entry) => entry.models.length > 0)
  }, [groups, query, showSearch])
  const rows = useMemo(
    () => effortRows(reasoning, copy.providerDefault),
    [reasoning, copy.providerDefault],
  )

  const close = useCallback((restoreFocus = false): void => {
    setOpen(false)
    setPane('root')
    setQuery('')
    if (restoreFocus) {
      queueMicrotask(() => {
        triggerRef.current?.focus()
      })
    }
  }, [])

  const closeAfterSelection = useCallback((): void => {
    setSelectionFocus(true)
    close(true)
  }, [close])

  const settle = useCallback(
    (result: SelectOutcome | undefined): void => {
      if (result === undefined) return
      if (result.ok) {
        closeAfterSelection()
        return
      }
      const error = result.error
      setMessage(
        error === undefined
          ? t('error.action', { message: 'selection rejected' })
          : error.code === 'session/writer-held'
            ? t('error.sessionInUse')
            : t('error.action', { message: `${error.code}: ${error.message}` }),
      )
    },
    [closeAfterSelection, t],
  )

  const submit = useCallback(
    (selection: Selection): void => {
      setSelectionFocus(true)
      setMessage(null)
      triggerRef.current?.focus({ preventScroll: true })
      void select(selection).then(settle)
    },
    [select, settle],
  )

  const choose = useCallback(
    (selection: Selection): void => {
      if (carries(selection, state.current)) {
        closeAfterSelection()
        return
      }
      submit(selection)
    },
    [closeAfterSelection, state.current, submit],
  )

  const chooseEffort = useCallback(
    (level: string | undefined): void => {
      if (state.current === null) return
      const effective = state.current.reasoningEffort ?? reasoning?.defaultEffort
      if (effective === level) {
        closeAfterSelection()
        return
      }
      submit({
        provider: state.current.provider,
        model: state.current.model,
        ...(level === undefined ? {} : { reasoningEffort: level }),
      })
    },
    [closeAfterSelection, reasoning?.defaultEffort, state.current, submit],
  )

  const reload = useCallback((): void => {
    setMessage(null)
    load()
  }, [load])

  const show = useCallback((): void => {
    setSelectionFocus(false)
    setQuery('')
    setMessage(null)
    focusRequest.current = state.current === null ? 'row' : null
    setPane(state.current === null ? 'model' : 'root')
    setOpen(true)
    triggerRef.current?.focus({ preventScroll: true })
    load()
  }, [load, state.current])

  const drill = useCallback((next: Exclude<Pane, 'root'>): void => {
    setQuery('')
    focusRequest.current = next === 'model' && choices.length > 4 ? 'search' : 'row'
    setPane(next)
  }, [choices.length])

  const back = useCallback((from: Exclude<Pane, 'root'>): void => {
    focusRequest.current = from === 'effort' ? 'cell1' : 'cell0'
    setPane('root')
  }, [])

  /** Move DOM focus through the menu's rows, wrapping at both ends. */
  const moveFocus = useCallback((offset: number): void => {
    const items = itemRefs.current.filter((item): item is HTMLElement => item !== null)
    if (items.length === 0) return
    const active = items.findIndex((item) => item === document.activeElement)
    const next =
      active === -1
        ? offset > 0
          ? 0
          : items.length - 1
        : (active + offset + items.length) % items.length
    items[next]?.focus()
  }, [])

  // Outside press closes the menu without stealing the click.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current?.contains(event.target as Node) === true) return
      if (menuRef.current?.contains(event.target as Node) === true) return
      close(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [close, open])

  // Consume one focus request per pane change.
  useEffect(() => {
    if (!open) return
    const request = focusRequest.current
    focusRequest.current = null
    if (request === null) return
    if (request === 'search') {
      searchRef.current?.focus()
      return
    }
    const target =
      request === 'row'
        ? menuRef.current?.querySelector('[role="menuitemradio"][aria-checked="true"]:not([disabled])') ??
          itemRefs.current.find((item) => item !== null && !(item as HTMLButtonElement).disabled)
        : itemRefs.current[request === 'cell1' ? 1 : 0]
    ;(target as HTMLElement | null | undefined)?.focus()
  }, [open, pane, query, showSearch])

  // Keep the highlighted row visible as the query narrows the list.
  useLayoutEffect(() => {
    if (!open || pane !== 'model') return
    const checked = menuRef.current?.querySelector('[role="menuitemradio"][aria-checked="true"]')
    // Guarded: a non-browser renderer (jsdom in tests) has no scrollIntoView.
    if (typeof checked?.scrollIntoView === 'function') checked.scrollIntoView({ block: 'nearest' })
  }, [open, pane, query])

  // Anchor the card above the trigger, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    const place = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect === undefined) return
      const width = menuRef.current?.offsetWidth ?? 0
      const height = menuRef.current?.offsetHeight ?? 0
      let x = rect.right - width
      let y = rect.top - 8 - height
      if (width > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - width - MARGIN)
      if (height > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - height - MARGIN)
      setMenuPos({ left: x, top: y })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, pane, state, query])

  if (!available) return null

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      if (pane !== 'root') back(pane)
      else close(true)
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key !== 'Tab') return
    if (event.shiftKey) {
      event.preventDefault()
      if (pane !== 'root') back(pane)
      else close(true)
      return
    }
    const focused = document.activeElement
    if (focused instanceof HTMLButtonElement && itemRefs.current.includes(focused)) {
      event.preventDefault()
      focused.click()
      return
    }
    if (focused !== triggerRef.current) return
    event.preventDefault()
    if (pane === 'model' && showSearch) {
      searchRef.current?.focus()
      return
    }
    const target =
      menuRef.current?.querySelector('[role="menuitemradio"][aria-checked="true"]:not([disabled])') ??
      itemRefs.current.find((item) => item !== null && !(item as HTMLButtonElement).disabled)
    ;(target as HTMLElement | null | undefined)?.focus()
  }

  itemRefs.current = []
  let itemIndex = 0
  const itemRef = (): ((node: HTMLElement | null) => void) => {
    const at = itemIndex++
    return (node) => {
      itemRefs.current[at] = node
    }
  }

  const aria = triggerAria(state, copy, {
    model: t('trigger.aria'),
    effort: t('trigger.ariaEffort'),
    select: t('trigger.selectAria'),
  })
  const triggerTitle = effort === undefined ? label : `${label} · ${effort}`

  /** One selectable model row. */
  const modelRow = (choice: ModelChoice): ReactNode => {
    const checked = carries(choice.selection, state.current)
    const pending = carries(choice.selection, state.pending)
    return (
      <button
        key={`${choice.selection.provider}/${choice.selection.model}`}
        ref={itemRef()}
        type="button"
        role="menuitemradio"
        aria-checked={checked}
        disabled={busy || locked}
        className={cx(CSS.option, checked && CSS.optionActive)}
        onClick={() => {
          choose(choice.selection)
        }}
      >
        <span className={CSS.optionCopy}>
          <span className={CSS.modelName}>{choice.model.name}</span>
        </span>
        {pending ? <Spinner /> : checked ? (
          <span className={CSS.check}>
            <IconCheck />
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div ref={rootRef} className={CSS.root} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={CSS.trigger}
        aria-label={aria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={triggerTitle}
        aria-busy={busy}
        data-selection-focus={selectionFocus ? '' : undefined}
        onBlur={() => {
          setSelectionFocus(false)
        }}
        disabled={locked}
        onClick={() => {
          if (open) close(true)
          else show()
        }}
      >
        <IconModel size={16} className={CSS.triggerIcon} />
        <span className={CSS.triggerLabel}>{label}</span>
        {effort !== undefined && <span className={CSS.triggerEffort}>{effort}</span>}
        {busy ? (
          <Spinner />
        ) : (
          <IconChevronDown className={cx(CSS.chevron, open && CSS.chevronOpen)} />
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={`${id}-menu`}
            className={CSS.surface}
            style={menuPos ?? MEASURE_STYLE}
          >
            {/* Opaque bed for macOS window vibrancy, then the blurred menu
                material — the same two layers the platform's menu surface uses,
                positioned from this plugin's own measurement. */}
            <div className={CSS.backing} aria-hidden="true" />
            <div className={CSS.material} aria-hidden="true" />
            <div
              className={CSS.menu}
              role="menu"
              aria-label={t('menu.aria')}
              aria-busy={state.status === 'loading' || busy}
            >
            {state.status === 'error' && state.error !== null && (
              <div className={CSS.error}>
                <span>{state.error}</span>
                <button type="button" className={CSS.retry} onClick={reload}>
                  {t('action.reload')}
                </button>
              </div>
            )}
            {failures.map((failure) => (
              <div key={failure.id} className={CSS.warning}>
                <span>{fill(t('warning.groupLoad'), { name: providerLabel(failure, copy.account), message: failure.message })}</span>
              </div>
            ))}
            {message !== null && (
              <div className={CSS.error}>
                <span>{message}</span>
                <button type="button" className={CSS.retry} onClick={reload}>
                  {t('action.reload')}
                </button>
              </div>
            )}
            {pane === 'root' && (
              <>
                <button
                  ref={itemRef()}
                  type="button"
                  role="menuitem"
                  className={CSS.cell}
                  onClick={() => {
                    drill('model')
                  }}
                >
                  <span className={CSS.cellLabel}>{t('menu.model')}</span>
                  <span className={CSS.cellValue}>{label}</span>
                  <IconChevronRight className={CSS.cellChevron} />
                </button>
                {reasoning !== undefined && (
                  <button
                    ref={itemRef()}
                    type="button"
                    role="menuitem"
                    className={CSS.cell}
                    onClick={() => {
                      drill('effort')
                    }}
                  >
                    <span className={CSS.cellLabel}>{t('menu.effort')}</span>
                    <span className={CSS.cellValue}>{effort ?? copy.providerDefault}</span>
                    <IconChevronRight className={CSS.cellChevron} />
                  </button>
                )}
              </>
            )}
            {pane === 'model' && (
              <>
                {showSearch && (
                  <div className={CSS.searchRow}>
                    <input
                      ref={searchRef}
                      type="text"
                      className={cx(CSS.search, query.length > 0 && CSS.searchWithQuery)}
                      value={query}
                      placeholder={t('search.placeholder')}
                      aria-label={t('search.placeholder')}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(event) => {
                        setQuery(event.target.value)
                      }}
                    />
                    {query.length > 0 && (
                      <button
                        type="button"
                        className={CSS.searchClear}
                        aria-label={t('search.clear')}
                        onClick={() => {
                          setQuery('')
                          searchRef.current?.focus()
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">
                          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                <div className={CSS.groups}>
                  {visibleGroups.length === 0 ? (
                    <div className={CSS.status}>{query.length > 0 ? t('search.empty') : t('empty.models')}</div>
                  ) : (
                    visibleGroups.map((entry) => (
                      <div key={entry.group.id} className={CSS.group}>
                        <div className={CSS.heading}>{providerLabel(entry.group, copy.account)}</div>
                        {entry.models.map((model) =>
                          modelRow({
                            group: entry.group,
                            model,
                            selection: selectionFor(entry.group, model),
                          }),
                        )}
                      </div>
                    ))
                  )}
                  {state.status === 'loading' && <div className={CSS.status}>{t('menu.loading')}</div>}
                </div>
              </>
            )}
            {pane === 'effort' && (
              <>
                {rows.length === 0 ? (
                  <div className={CSS.status}>{t('empty.efforts')}</div>
                ) : (
                  rows.map((row) => {
                    const effective = state.current?.reasoningEffort ?? reasoning?.defaultEffort
                    const checked = effective === row.effort
                    const pending =
                      state.pending !== null &&
                      state.current !== null &&
                      state.pending.provider === state.current.provider &&
                      state.pending.model === state.current.model &&
                      (state.pending.reasoningEffort ?? reasoning?.defaultEffort) === row.effort
                    return (
                      <button
                        key={row.key}
                        ref={itemRef()}
                        type="button"
                        role="menuitemradio"
                        aria-checked={checked}
                        disabled={busy || locked}
                        className={cx(CSS.option, checked && CSS.optionActive)}
                        onClick={() => {
                          chooseEffort(row.effort)
                        }}
                      >
                        <span className={CSS.optionCopy}>
                          <span className={CSS.modelName}>{row.label}</span>
                        </span>
                        {pending ? <Spinner /> : checked ? (
                          <span className={CSS.check}>
                            <IconCheck />
                          </span>
                        ) : null}
                      </button>
                    )
                  })
                )}
              </>
            )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}