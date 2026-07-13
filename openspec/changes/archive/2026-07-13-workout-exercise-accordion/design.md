# Design: workout-exercise-accordion

## Context

`renderWorkout` (`docs/app.js:1219`) renders each routine exercise as an
`article.exercise` containing head (name), notes, stat chips, set rows, and an
optional media panel — all always visible. The app is a no-framework PWA: every
state change triggers a full re-render via `mount()`, with scroll preserved on
same-route re-renders. Transient view state lives in the module-level `ui`
object (`docs/app.js:11-30`); `resetTransient()` clears the navigation-scoped
subset. Tap handling is delegated through `data-action` attributes resolved by
`closest()`, so nested interactive elements win over card-level handlers.
Completion styling already exists: `.exercise.complete { border-color:
var(--accent) }` (`docs/styles.css:434`).

## Goals / Non-Goals

**Goals:**
- Single-expansion accordion on the workout screen per the spec.
- Zero data-model or storage changes.
- Keep the existing e2e step "I mark the first set complete" passing.

**Non-Goals:**
- Auto-advance to the next exercise on completion (explicitly rejected — users
  adjust weights or uncheck series after finishing).
- Expand/collapse animation polish beyond basic CSS (can iterate later).
- Accordion behavior on any screen other than the workout view.

## Decisions

### D1: State — `ui.expandedExercise` scalar in `UI_DEFAULTS`

A single `expandedExercise: null` field (exercise instance id or `null`).
Placing it in `UI_DEFAULTS` makes `resetTransient()` clear it on navigation
for free, satisfying the transience requirement.

Alternative considered: a `Set` like `ui.expandedMedia` — rejected; the
single-expansion invariant is a scalar by definition, and `expandedMedia`'s
survives-navigation semantics are the opposite of what the spec requires.

`null` is overloaded: it means both "not yet initialized" and "user collapsed
everything". Disambiguate with a companion flag or a sentinel — use
`ui.expandedExercise = undefined` as "uninitialized" (apply the entry rule)
vs `null` as "deliberately all collapsed". `renderWorkout` resolves
`undefined` → first incomplete exercise id (or `null`) at render time rather
than at navigation time, so the entry rule needs no router hook.

### D2: Collapsed rendering — omit subtrees, don't hide with CSS

Collapsed cards simply do not render the `.sets` block or the media panel
(same pattern as the media embed, which only mounts when open). This keeps the
DOM minimal, avoids loading media resources for collapsed cards, and makes the
e2e assertion "contains no set toggles" straightforward.

Alternative: render everything and toggle `display:none` — rejected; it mounts
media iframes for every exercise and contradicts the existing lazy-mount
comment at `docs/app.js:1285`.

### D3: Tap targets — card-level `data-action="expand-exercise"` on collapsed cards; header-level collapse on the expanded card

- Collapsed card: the whole `article` (or a full-width wrapper button) carries
  `data-action="expand-exercise" data-exercise="<id>"`. One large target.
- Expanded card: the `.ex-head` region carries
  `data-action="collapse-exercise"`. Set rows and media toggle keep their own
  `data-action`s; delegation via `closest()` already gives them precedence.
- Handler: `expand-exercise` sets `ui.expandedExercise = id`; since the state
  is a scalar, the previously expanded card collapses on the same re-render —
  the invariant is structural, not enforced by bookkeeping.
- Edit mode: neither action is emitted (attributes not rendered), disabling
  expansion without special-casing the handler.

Accessibility: the collapsed tap target is a `<button>`-like element with
`aria-expanded` and an `aria-label` naming the exercise.

### D4: `ui.expandedMedia` untouched

Media open/closed state is orthogonal and keyed per exercise; a collapsed card
just doesn't render the panel. Re-expanding restores the panel with its prior
open/closed state — no migration, no interaction.

### D5: Scroll behavior — accept default re-render behavior

Expanding B while A (above it) collapses shifts content up by A's set-list
height. The existing same-route scroll preservation applies; no scroll
correction in v1. If it feels jumpy in practice, a follow-up can
`scrollIntoView` the newly expanded card.

## Risks / Trade-offs

- [Tap-to-expand vs accidental set toggles] Collapsed cards are one big
  button; a user aiming at a chip expands the card — harmless. The reverse
  (expanded card mis-taps) is unchanged from today. → No mitigation needed.
- [e2e fragility] Tests that tap set toggles in a second exercise must expand
  it first. Only `workout_steps.rb:4` (`set-toggle .first`) exists today and
  stays valid via the initial-expansion rule. → Add accordion steps/scenarios;
  audit features for multi-exercise set taps during implementation.
- [Scroll jump on switch] See D5. → Deferred; revisit after manual testing on
  device.
- [Stale id] `ui.expandedExercise` may reference an exercise removed in edit
  mode. Render treats an unmatched id as all-collapsed — harmless by
  construction since collapse/expand is recomputed per render. → No action.

## Migration Plan

Pure UI change, no data migration. Bump the service-worker cache version in
`docs/sw.js` (release requirement per repo convention). Rollback = revert
commit.

## Open Questions

None — interaction decisions were locked during explore
(entry rule, no auto-advance, collapsed content, edit mode, transience).
