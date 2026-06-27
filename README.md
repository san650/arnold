# Arnold

Gym workout tracker. Offline-first.

## Deployment

The deployable app lives in [`docs/`](./docs). GitHub Pages is configured to
serve from the **`/docs` folder on the default branch** (Settings → Pages →
Build and deployment → Source: "Deploy from a branch", Folder: `/docs`). Only
the app is served; repository tooling (`openspec/`, `test/`, etc.) stays at the
root and is not published.

## Tests

End-to-end tests live in [`test/`](./test): Cucumber (Ruby) driving a real
browser via Playwright. One-time setup, then run:

```sh
cd test
bundle install                  # Ruby gems (cucumber, playwright-ruby-client, …)
npx playwright install chromium # Playwright browser (matches the gem version)
ruby run.rb                     # starts a Playwright server, runs all features
```

`ruby run.rb` boots the Playwright browser server and runs the whole suite; pass
a path to run one feature (e.g. `ruby run.rb features/catalog.feature`). The
tests serve `docs/` over a local server and run each scenario in a fresh browser
context (so the seed is the starting state).

## License

[MIT](./LICENSE) — Copyright (c) 2026 Santiago Ferreira.
