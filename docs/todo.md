# Project TODOs

Concrete, actionable tasks to improve the starmap data pipeline, rendering, and DX. Grouped by area with expected touchpoints and acceptance hints.

## Data Pipeline

- [ ] Source black hole IDs from data instead of hardcoding `[30000001, 30000002, 30000003]`: add an optional SQLite table/CSV input in `data/build_data.py`, fall back to the current list, and update the manifest counts/tests accordingly.
- [ ] Add integrity validation after asset build: fail the build if `len(positions)/3 !== len(ids)`, jumps reference missing systems, or station/black-hole lists contain unknown IDs; emit a concise summary to stderr.
- [ ] Persist computed bounds and system counts to `manifest.json` during build so the frontend can skip recomputing bounds on load (helps fit-to-view and debug logging).

## Frontend Rendering & UX

- [ ] Add a user-facing loading/error overlay with a retry button that appears when any binary fetch fails; pipe the underlying error into `debugLog` and keep the debug panel copy-pasteable for bug reports.
- [ ] Introduce a small on-screen legend/toggle explaining point colors and sizes (regular systems, station systems, black holes) and allow hiding individual layers without reloading.
- [ ] Add a "Reset view" button that re-centers the camera on dataset bounds and restores default zoom/damping; reuse the bounds that are computed (or cached via manifest).
- [ ] When focusing a system (search or route click), show a badge in the info panel indicating station presence or black-hole status, and ensure the sprite briefly highlights (scale/opacity pulse) for discoverability.

## Performance & Caching

- [ ] Cache binary blobs (positions/ids/jumps/stations/black-holes) in IndexedDB keyed by `VERSION_KEY` or manifest release; on cache hit, skip refetch and only validate manifest version.

## Testing & CI

- [ ] Extend JS unit tests to cover `makeStarfield` layer separation: assert counts, per-layer point sizes/colors, and index mapping for station/black-hole arrays.
- [ ] Add an integration test that stubs one data fetch to 404 and verifies the new error overlay shows with retry + debug text, while leaving the debug panel logging intact.

## Documentation

- [ ] Document the new data-caching/legend/error overlay behaviors in `docs/README.md`, including a short troubleshooting note for browsers lacking `DecompressionStream` support and how to enable the debug panel.
