# Project TODOs

Concrete, actionable tasks to improve the starmap data pipeline, rendering, and DX. Grouped by area with expected touchpoints and acceptance hints.

## Data Pipeline

- [x] Source black hole IDs from data instead of hardcoding `[30000001, 30000002, 30000003]`: add an optional SQLite table/CSV input in `data/build_data.py`, fall back to the current list, and update the manifest counts/tests accordingly.
  - Acceptance: `--black-holes-csv` and/or `--black-holes-table` flags supported and documented; Python unit tests validate parsing, fallback behavior, and that the build fails when supplied IDs are missing from the systems table.
- [ ] Add integrity validation after asset build: fail the build if `len(positions)/3 !== len(ids)`, jumps reference missing systems, or station/black-hole lists contain unknown IDs; emit a concise summary to stderr.
- [ ] Persist computed bounds and system counts to `manifest.json` during build so the frontend can skip recomputing bounds on load (helps fit-to-view and debug logging).
- [ ] Persist additional metadata to `manifest.json`: include `bounds` (min/max/center/radius), per-layer counts, and an optional checksum (sha256) for each binary blob so the frontend can quickly validate cached assets.
  - Acceptance: `manifest.json` contains `bounds.center`, `bounds.radius`, `counts.{systems,jumps,stations,black_holes}`, and `blobs.<name>.sha256` when `--release` or `--hash` option is passed; a Python unit test validates these fields are written.
- [x] Detect and fail on duplicate or non-unique system IDs during build (prevent subtle indexing bugs downstream).
  - Acceptance: Implemented — `build_data.py` now exits with a clear diagnostic when duplicate IDs are present; `tests/unit/test_build_data_duplicates.py` verifies the failure mode.
- [ ] Allow optional input tables/files for stations and black holes instead of hardcoding; provide CLI flags and fallbacks (CSV or SQLite table).
  - Acceptance: `--black-holes-csv` and/or `--black-holes-table` flags supported and documented; tests validate parsing and fallback behavior.

## Frontend Rendering & UX

- [ ] Add a user-facing loading/error overlay with a retry button that appears when any binary fetch fails; pipe the underlying error into `debugLog` and keep the debug panel copy-pasteable for bug reports.
- [ ] Introduce a small on-screen legend/toggle explaining point colors and sizes (regular systems, station systems, black holes) and allow hiding individual layers without reloading.
- [ ] Add a "Reset view" button that re-centers the camera on dataset bounds and restores default zoom/damping; reuse the bounds that are computed (or cached via manifest).
- [ ] When focusing a system (search or route click), show a badge in the info panel indicating station presence or black-hole status, and ensure the sprite briefly highlights (scale/opacity pulse) for discoverability.
- [ ] Implement graceful fetch/retry strategy with timeouts and exponential backoff for network fetches (`fetchArrayBuffer` and `fetchJsonSafe`), and surface retry UI in the overlay.
  - Acceptance: a network failure triggers the overlay with the error message and a "Retry" button; Playwright integration test simulates a 404 and verifies overlay + retry logic and that `debugLog` contains the underlying error message.
- [ ] Make layer visibility/toggles persistent (store user choices in `localStorage`) and expose simple controls for layer opacity and size scaling.
  - Acceptance: toggling 'stations' off removes the stations Points object from scene (or sets visible=false); state persists across page reloads.
- [ ] Add keyboard accessibility and ARIA attributes to search, overlay, legend, and route table (tab focusable, proper roles, labels).
  - Acceptance: keyboard-only navigation and screen-reader announcement tests are documented; basic ARIA roles exist in markup.
- [ ] Add an easily copyable "Export debug log" button next to the debug panel to help with bug reports.
  - Acceptance: button copies the debug panel contents to clipboard and shows a brief confirmation tooltip.

## Performance & Caching

- [ ] Cache binary blobs (positions/ids/jumps/stations/black-holes) in IndexedDB keyed by `VERSION_KEY` or manifest release; on cache hit, skip refetch and only validate manifest version.
- [ ] Add optional Service Worker or prefetch hook that serves cached assets (IndexedDB or Cache API) and falls back to network when missing; provide a toggle for enabling experimental offline mode.
  - Acceptance: enabling offline mode serves assets from cache when the network is offline (Playwright offline emulation test confirms it), and the manifest version check invalidates cache when mismatched.
- [ ] Consider GPU-friendly optimizations for very large datasets: support uploading BufferGeometry once and/or using InstancedBufferGeometry for repeated sprites, plus option to reduce point sizes or LOD at runtime.
  - Acceptance: benchmark notes or a small prototype branch showing measurable frame-rate improvements for >100k points.

## Testing & CI

- [ ] Extend JS unit tests to cover `makeStarfield` layer separation: assert counts, per-layer point sizes/colors, and index mapping for station/black-hole arrays.
- [ ] Add an integration test that stubs one data fetch to 404 and verifies the new error overlay shows with retry + debug text, while leaving the debug panel logging intact.
- [ ] Add unit tests that validate `manifest.json` contents after `npm run build:data`, including the new `bounds`, `counts` and optional `sha256` fields.
  - Acceptance: `pytest` includes a test that runs `build_data.py` against a small fixture DB (or mocked rows) and asserts manifest keys and values.
- [ ] Add a Playwright test that verifies focus via URL `?focus=NAME` and asserts the persistent focus label appears with station/black-hole badge as appropriate.
- [ ] Add CI jobs to run `npm audit`/`pip-audit` and fail the pipeline on high/severe vulnerabilities or automatically open Dependabot PRs.

## Documentation

- [ ] Document the new data-caching/legend/error overlay behaviors in `docs/README.md`, including a short troubleshooting note for browsers lacking `DecompressionStream` support and how to enable the debug panel.
- [ ] Add `CONTRIBUTING.md` with developer setup (how to generate data, run tests, run integration tests with Playwright), and add short guidelines for writing new unit/integration tests.
- [ ] Document the `manifest.json` schema (fields added above) and expected binary file formats (endian, types, components) in `docs/README.md` for consumers of the dataset.
- [ ] Add a short troubleshooting checklist for common local issues (missing `data/static.db`, `build:data` required before `npm run dev`, enabling `debug=true` query param, and where to find `debug-log`).

## Security & Dependencies

- [ ] Add automated dependency updates (Dependabot or similar) and a scheduled audit step in CI for `npm` and `pip` dependencies.
  - Acceptance: a GitHub Actions job exists that runs `npm audit --audit-level=high` and `pip-audit` and fails on critical findings; Dependabot configured in repo.
- [ ] Pin three.js and other CDN imports where feasible (or vendor/bundle them) and consider adding SRI/integrity checks for third-party CDN imports.
  - Acceptance: PR or docs note describing a chosen strategy (import map, local bundle, or SRI) and a follow-up task to implement it.

## Code Quality & Developer Experience

- [ ] Expand ESLint config to include stricter rules (no-console except `debugLog`, prefer const, consistent ordering) and add `npm run lint:fix` tasks.
  - Acceptance: `npm run lint` runs in CI and `--max-warnings=0` is enforced for PRs.
- [ ] Add JSDoc/type annotations for critical functions (`loadData`, `makeStarfield`, `fetchArrayBuffer`) or add TypeScript typing for the data pipeline boundaries.
  - Acceptance: short JSDoc comments added and a follow-up issue/PR scoped for typing the frontend code.

## Observability & Debugging

- [ ] Enhance the debug panel to include fetch timings, response sizes, manifest version and data_release info; expose an "Export" button to copy logs.
  - Acceptance: debug panel prints fetch durations and sizes, and integration tests assert that these values exist in the debug panel when `debug=true`.

## Accessibility

- [ ] Improve accessibility of UI components (search, overlay, legend, route table) with focus management and ARIA roles; add a high-contrast mode toggle.
  - Acceptance: simple keyboard navigation walkthrough in `docs/README.md` and basic a11y assertions in integration tests (e.g., route table focusable, ARIA labels present).

## Build & Release

- [ ] Ensure `build.sh` / CI inject a `RELEASE_TAG` or commit SHA into `manifest.json` (already partly done in `build.sh`) and include `data_release` and `build_commit` fields for reproducibility.
  - Acceptance: `manifest.json` includes `release` and `build_commit` fields in CI builds; release notes are generated with these values.

---

💡 Tip: Prioritize items that improve reliability (manifest + validation + retries), tests that catch regressions, and small UX wins (overlay + legend + export debug) — these will give the best ROI for bug triage and support.
