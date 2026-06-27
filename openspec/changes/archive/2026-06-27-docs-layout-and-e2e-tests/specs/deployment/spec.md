## ADDED Requirements

### Requirement: Deployable site lives in `docs/`

The deployable application SHALL live in a `docs/` directory and GitHub Pages
SHALL serve the site from `/docs`. Only application files (markup, scripts,
styles, service worker, manifest, icons, splash images, data files, `CNAME`,
`.nojekyll`) SHALL reside in `docs/`. Repository tooling and planning files
(`openspec/`, `.claude/`, `README.md`, `LICENSE`, tests) SHALL remain outside
`docs/` and MUST NOT be served.

#### Scenario: Only app files are served

- **WHEN** the site is built/served from `/docs`
- **THEN** requests resolve to application files under `docs/`, and repository
  tooling/planning files (e.g. `openspec/`, `test/`) are not reachable

#### Scenario: Relative references resolve after the move

- **WHEN** the app is loaded from the `docs/`-rooted site
- **THEN** all script, style, manifest, icon, and service-worker references
  resolve correctly using their existing relative paths, and the service worker
  registers with a scope covering the served site
