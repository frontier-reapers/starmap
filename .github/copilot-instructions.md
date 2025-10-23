# Starmap Project - AI Coding Agent Instructions

## Project Overview

3D interactive star map visualization rendering EVE Online solar system data using three.js with WebGL. The app loads pre-processed binary data files (positions, jumps) and renders them as Points and LineSegments with OrbitControls.

## Architecture & Data Flow

### Two-Stage Pipeline

1. **Data Builder (Python)**: `data/build_data.py` reads SQLite → outputs binary files to `public/data/`
2. **Web App (JS)**: `src/main.js` fetches binary data → parses TypedArrays → renders with three.js

### Critical Coordinate System Transform

- **Input**: EVE Online coordinates in meters, y-up axis
- **Transform**: Apply `Rx(-90°)` rotation: `(x, y, z) → (x, z, -y)` AFTER converting meters to light-years
- **Output**: three.js space in light-years, y-up axis
- **Location**: Transform applied in BOTH `build_data.py` (via `transform_xyz()`) AND `src/main.js` (in `loadData()` after fetch)

### Binary Data Format

- `systems_positions.bin` - Float32Array (x,y,z triplets in light-years, post-transform)
- `systems_ids.bin` - Uint32Array of system IDs
- `systems_names.json` - JSON object mapping system IDs to names
- `jumps.bin` - Uint32Array of system ID pairs (from→to)
- **Endianness**: Native little-endian (Python `array.tobytes()` → JS `TypedArray` direct read)

## Development Workflows

### Initial Setup & Data Generation

```pwsh
npm install
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Obtain static.db from latest release at https://github.com/Scetrov/evefrontier_datasets
# Place in data/static.db

npm run build:data  # REQUIRED before first run - generates binary files
```

### Running the App

- **Dev server**: `npm run dev` → http://localhost:3000/public/
- **VS Code Task**: "Start Dev Server" (recommended)
- **Docker**: `docker-compose up web` → http://localhost:8080/public/

### Testing Strategy

- **Unit tests (JS)**: `npm run test:unit:js` - Vitest tests for coordinate transforms, bounds, binary parsing
- **Unit tests (Python)**: `npm run test:unit:py` - pytest for data transformation logic
- **Integration tests**: `npm run test:integration` - Playwright E2E tests (requires dev server running)
- **Watch mode**: Use VS Code task "Watch Tests" for TDD workflow

## Project-Specific Conventions

### Debug Logging Pattern

All runtime logging uses `debugLog()` which outputs to both console AND an on-screen debug panel (#debug-log, bottom-right). When debugging rendering issues, check this panel for data loading progress, parsed data sizes, and bounds computation.

### File Organization

- **No build step**: Uses ES6 modules + import maps for three.js CDN (no webpack/vite)
- **Binary data is gitignored**: `public/data/*.bin` files must be generated locally via `build_data.py`
- **SQLite source**: `data/static.db` is gitignored - obtain from https://github.com/Scetrov/evefrontier_datasets (latest release)

### Testing Patterns

- **Integration tests**: Use `page.waitForFunction()` to poll debug panel content for async events
- **Python tests**: Use `pytest-cov` for coverage reports (see `pyproject.toml` config)
- **Playwright config**: Auto-starts dev server via `webServer` option - don't manually start for integration tests

### Docker Multi-Stage

- **Dockerfile.web**: nginx serving static files (no Node.js runtime)
- **Dockerfile.data**: Python builder container (use with volume mounts for one-time data generation)
- Use `docker-compose --profile tools run data-builder` for data generation in Docker

### Development Loop

- Run `npm run build:data` after any changes to the SQLite schema or data source to regenerate binary files.
- Use `npm run test:all` to run all tests (unit + integration) after making changes.
- Make commits at sensible checkpoints with clear conventional commits.

## Common Gotchas

1. **Coordinate transform applied TWICE**: Once in Python during data generation, once in JS after fetch. Don't double-apply when debugging.
2. **Integration tests require running server**: Playwright config auto-starts it, but manual runs need `npm run dev` first.
3. **Binary data endianness**: TypedArrays default to little-endian - matches Python `array.tobytes()` output. No conversion needed.
4. **Three.js version pinned**: Using CDN imports at version 0.160.0 - update all three imports together if upgrading.
5. **URL paths**: HTML references `../src/main.js` because it lives in `public/` subdirectory - maintain this structure.

## Key Files for Understanding

- `src/main.js` (340 lines) - Complete rendering pipeline from fetch to render loop
- `data/build_data.py` (174 lines) - Data transformation with auto-detection of SQLite schema
- `tests/integration/starmap.spec.js` - E2E test patterns for WebGL apps
- `docs/README.md` - Comprehensive architecture documentation

## CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

Automated pipeline runs on push/PR to main/develop branches:

1. **test-js** - JavaScript unit tests with Vitest
2. **test-python** - Python unit tests with pytest + coverage
3. **test-integration** - Playwright E2E tests with mock data generation
4. **build-docker** - Build and push Docker images to GHCR (main branch only)
5. **lint** - ESLint code quality checks

**Key features**:

- Parallel test execution for faster CI
- Automatic download of latest static.db from evefrontier_datasets repository
- Real data generation for integration tests using build_data.py
- Docker image caching for faster builds
- Coverage reports uploaded as artifacts
- Only builds Docker images on successful tests

## Quick Reference

### VS Code Tasks (Ctrl+Shift+P → "Tasks: Run Task")

- "Start Dev Server" - Primary development command
- "Build Data from SQLite" - Regenerate binary files after DB changes
- "Run All Tests" - Full test suite (unit + integration)
- "Watch Tests" - TDD mode for JS unit tests

### npm Scripts

- `npm run dev` - http-server on port 3000
- `npm run build:data` - Python data builder
- `npm test` - Unit tests only (JS + Python)
- `npm run test:all` - All tests including integration
