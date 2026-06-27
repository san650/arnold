## ADDED Requirements

### Requirement: Cucumber + Playwright e2e suite

The repository SHALL include an end-to-end test suite under `test/`, written with
Cucumber (Ruby) using the Playwright backend (`playwright-ruby-client`), with a
`Gemfile` declaring its dependencies. The suite SHALL serve the `docs/` app over
a local static server, drive it in a real browser via a Playwright browser
server, and fail the run if any scenario fails. A `run.rb` entrypoint SHALL start
the Playwright server and run the suite in one command (`ruby run.rb`).

#### Scenario: Run the suite

- **WHEN** a developer runs `ruby run.rb` in `test/` (after `bundle install` and
  `npx playwright install chromium`)
- **THEN** it starts the Playwright browser server, serves `docs/`, drives a
  browser, executes every scenario, and exits non-zero if any scenario failed

#### Scenario: Dependencies are declared

- **WHEN** setting up the suite
- **THEN** a `Gemfile` declares `cucumber`, `playwright-ruby-client`, and
  `rspec-expectations` (plus the static-server dependency)

### Requirement: Feature coverage across the application, isolated scenarios

The suite SHALL provide Cucumber feature files covering the application's
user-facing features (routines home, workout logging, routine editing, the
exercise catalog with create/edit/delete-cascade and pick-into-routine, exercise
detail, progress dashboard, undo/redo, and motivation). Each scenario SHALL run
against a fresh browser context so the seed is the known starting state, and
SHALL assert on observable behavior (rendered UI and/or the persisted document).

#### Scenario: Scenarios are isolated

- **WHEN** a scenario begins
- **THEN** it runs in a fresh browser context with empty storage, so the app
  starts from the seed independent of other scenarios

#### Scenario: Features are covered

- **WHEN** a user-facing feature exists
- **THEN** the suite contains a `.feature` file with scenarios exercising it
  end-to-end
