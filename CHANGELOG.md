# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- data: Compute and persist dataset bounds in `manifest.json` (`bounds.min`, `bounds.max`, `bounds.center`, `bounds.radius`) so the frontend can quickly fit the view without recomputing on load.
- data: Add `--hash` CLI flag (and imply hashing when `--release` is used) to compute SHA-256 checksums for all output blobs and store them in `manifest.json` under `blobs.<filename>.sha256` for cache validation.
- tests: Add `tests/unit/test_manifest.py` and Playwright integration test to validate `manifest.json` contains bounds and blob checksum metadata.
- ci: Ensure `npm run build:data` runs before integration tests and fail the job if `manifest.json` lacks `bounds` or `systems_positions.bin` sha256.

### Changed

- docs: Documented the `--hash` flag and manifest schema additions in `docs/README.md` and `README.md`.


---

For release notes, move pending items from **Unreleased** to a versioned header (e.g., `## [0.1.0] - 2026-01-01`).
