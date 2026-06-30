# Writing e2e tests for Arnold

The suite is **Cucumber (Ruby) driving a real browser via Playwright**. It serves
`docs/` over a local server and runs each scenario in a **fresh browser context**
(empty storage → the app seeds itself, so the seed is every scenario's starting
state). Follow these conventions so new tests stay consistent and stable.

## Gherkin style — declarative, not imperative

Feature files describe **what the lifter does**, never **how the UI does it**.
A feature file must contain **no selectors, URLs, or clicks** — those live only in
step definitions.

```gherkin
# good — intent
When I add the exercise "Peso muerto con barra" to the routine

# bad — UI mechanics leaking into the feature
When I tap the add-exercise button
And I pick "Peso muerto con barra" from the catalog
```

Also: third-person ("I add…", "I should see…"), **one action per step** (no
conjunctive "and" inside a step), and **no trailing punctuation** on steps.

## File organization

- **One feature file per functionality** (`workout.feature`, `catalog.feature`,
  `builder.feature`, …). Each file runs independently.
- Put a shared precondition in a **`Background`** rather than repeating a `Given`
  in every scenario.
- Use **`Scenario Outline` + `Examples`** for parametric cases (bounds, variants,
  round-trips). Never copy-paste a scenario with one value changed.

## Tags

Every feature is tagged so groups can run selectively:

| Tag | Covers |
|---|---|
| `@smoke` | Core flows (home, motivation) — run on every PR |
| `@workout` | Logging sets, editing a routine's exercises |
| `@routines` | Rename / add / remove / reorder routines |
| `@catalog` | Browse, manage, and exercise-detail |
| `@builder` | Guided week builder |
| `@log` | Action log |
| `@data` | Export / import / reset |
| `@dashboard` | Progress screen |
| `@undo` | Undo / redo |

Run a group with the smoke profile (`ruby run.rb -p smoke`) or an ad-hoc tag
(`ruby run.rb --tags @catalog`).

## Selectors (step definitions only)

- **Assertions / counts** use `[data-test-id="…"]` (helper: `data_test('…')`).
- **Interactions** use the app's semantic action hooks: `[data-action="…"]`
  (e.g. `add-exercise`, `series-step`, `menu`, `export`, `import`, `reset`,
  `build-pick-commit`) and the reorder hooks (`[data-reorder-list]`,
  `[data-reorder-index]`, `[data-drag-handle]`).
- **Never** navigate by free text — no `get_by_text(exact: false)`. Scope to a
  card/row instead (e.g. `#{data_test('routine-card')}:has-text("…")`).
- When a selector matches more than one node (a modal's backdrop *and* its
  button both carry `data-modal-action`), scope to the specific element
  (`button[data-modal-action="cancel"]`).

## Assertions — prefer storage

Assert the **persisted outcome** by reading IndexedDB through `app_doc` /
`wait_doc`, not just visible text. Persistence is async after a dispatch, so poll
with `wait_doc` and guard against a nil doc:

```ruby
doc = wait_doc { |d| d && d['routines'].length == n }
```

Note: the app only **writes to storage on the first mutation**. A pure no-op
(e.g. a *cancelled* delete) leaves storage empty — assert the on-screen list in
that case instead (`the routines editor should list N routines`).

## Step reuse

- Reuse the existing vocabulary before inventing a step. Shared helpers
  (`app_doc`, `routine`, `wait_doc`, `reorder`, `set_field`, `exercise_name_at`,
  …) live in `features/support/env.rb` — keep storage/util helpers there, not
  duplicated per feature.
- Group steps by domain: `common_steps.rb` (navigation, dialogs, generic
  assertions), `workout_steps.rb`, `catalog_steps.rb`, `builder_steps.rb`,
  `data_steps.rb`.

## Running

```sh
cd test
ruby run.rb                         # whole suite (boots Playwright + WEBrick)
ruby run.rb features/builder.feature # one feature
ruby run.rb -p smoke                 # @smoke only
ruby run.rb --tags @catalog          # one tag group
```

## Version sync

Playwright is pinned in three places that must move together on any bump:
`PW_VERSION` in `run.rb`, the `playwright-ruby-client` gem in `Gemfile`, and the
two `1.60.0` cache keys + install steps in `.github/workflows/test.yml`.
