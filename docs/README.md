# Starmap (Three.js)

A 3D interactive star map visualization using three.js, rendering EVE Online solar system data with orbital controls and hover labels.

## Project Structure

```
starmap/
├── src/                    # Source code
│   └── main.js            # Main application logic
├── public/                 # Static assets
│   ├── index.html         # Entry point
│   ├── favicon.ico        # Site icon
│   └── data/              # Generated binary data files
│       ├── manifest.json
│       ├── systems_positions.bin
│       ├── systems_ids.bin
│       ├── systems_names.json
│       └── jumps.bin
├── data/                   # Data processing
│   ├── build_data.py      # SQLite → binary converter
│   ├── inspect_db.py      # Database inspection utility
│   └── static.db          # EVE Online database (gitignored)
├── tests/                  # Test suites
│   ├── unit/              # Unit tests
│   │   ├── test_build_data.py      # Python tests
│   │   └── starmap.test.js         # JS tests
│   └── integration/       # Integration tests
│       └── starmap.spec.js         # E2E tests
├── docker/                 # Docker configurations
│   ├── Dockerfile.web     # Web server container
│   └── Dockerfile.data    # Data builder container
├── docs/                   # Documentation
│   ├── README.md          # Full documentation (this file)
│   └── MIGRATION_SUMMARY.md  # Migration details
├── .vscode/               # VS Code configuration
│   └── tasks.json         # Build/run/test tasks
├── package.json           # Node.js dependencies
├── requirements.txt       # Python dependencies
├── docker-compose.yml     # Docker orchestration
└── README.md              # Quick start guide
```

## Quick Start

### Prerequisites
- Node.js 18+ (for dev server and tests)
- Python 3.12+ (for data processing)
- Docker (optional, for containerized deployment)

### Installation

1. **Install JavaScript dependencies:**
   ```bash
   npm install
   ```

2. **Set up Python environment:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   # or: source .venv/bin/activate  # macOS/Linux
   pip install -r requirements.txt
   ```

### Development

1. **Generate binary data** from SQLite database:
   ```bash
   npm run build:data
   # or manually:
   python data/build_data.py --db data/static.db --out public/data
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000/public/ in your browser.

### Testing

```bash
# Run all unit tests (JS + Python)
npm test

# Run JavaScript unit tests only
npm run test:unit:js

# Run Python unit tests only
npm run test:unit:py

# Run integration tests (E2E - requires dev server running)
npm run test:integration

# Run ALL tests (unit + integration)
npm run test:all

# Watch mode for JS unit tests
npm run test:watch
```

**Test Summary:**
- **JavaScript Unit Tests**: 8 tests for coordinate transforms, bounds computation, and binary parsing
- **Python Unit Tests**: 5 tests for data transformation and conversion logic
- **Integration Tests**: 8-9 E2E tests using Playwright (requires dev server)

**Note:** Integration tests require the development server to be running. Start it with `npm run dev` in a separate terminal before running `npm run test:integration` or `npm run test:all`.

### VS Code Tasks

Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and type "Run Task" to access:

- **Start Dev Server** - Launch local HTTP server on port 3000
- **Build Data from SQLite** - Regenerate binary data files
- **Run Unit Tests** - Execute JavaScript unit tests
- **Run Integration Tests** - Run Playwright E2E tests
- **Run All Tests** - Execute full test suite
- **Run Python Tests** - Execute Python unit tests
- **Docker: Build Web Image** - Build nginx container
- **Docker: Build Data Builder Image** - Build data processing container
- **Docker: Run Web Server** - Start web container on port 8080
- **Watch Tests** - Run tests in watch mode

## Docker Deployment

### Web Application

Build and run the web server container:

```bash
# Build image
npm run docker:build:web
# or: docker build -f docker/Dockerfile.web -t starmap-web .

# Run container
npm run docker:run:web
# or: docker run -p 8080:80 starmap-web
```

Access at http://localhost:8080/public/

### Data Builder

Build and run the data processing container:

```bash
# Build image
docker build -f docker/Dockerfile.data -t starmap-data .

# Run with volume mounts
docker run \
  -v $(pwd)/data/static.db:/app/data/static.db \
  -v $(pwd)/public/data:/app/output \
  starmap-data
```

## Data Format

### Input: SQLite Database (`data/static.db`)
- **SolarSystems** table with columns: `solarSystemId`, `name`, `centerX`, `centerY`, `centerZ` (positions in meters)
- **Jumps** table with columns for system-to-system connections

### Output: Binary Files (`public/data/`)
- **systems_positions.bin** - Float32Array of (x,y,z) coordinates in light-years with Rx(-90°) transform
- **systems_ids.bin** - Uint32Array of system IDs
- **systems_names.json** - JSON object mapping system IDs to names
- **jumps.bin** - Uint32Array of jump pairs (system ID pairs)
- **manifest.json** - Metadata describing the data format

## Architecture

### Coordinate System
- **Input**: EVE Online coordinates in meters (y-up)
- **Transform**: Rx(-90°) rotation: `(x, y, z) → (x, z, -y)`
- **Output**: Light-years in three.js space (y-up)

### Rendering Pipeline
1. Load binary data files via `fetch()`
2. Parse as TypedArrays (native little-endian)
3. Apply coordinate transform
4. Create three.js Points geometry for stars
5. Create LineSegments geometry for jumps
6. Render with OrbitControls and CSS2D labels

### Debug Mode
The application includes an on-screen debug panel (bottom-right) showing:
- Data loading progress
- Parsed data sizes
- Computed bounds and camera position
- Render loop status

## Development Notes

### Browser Compatibility
- Requires ES6 modules support
- Uses import maps for three.js CDN imports
- Tested on Chrome 100+, Firefox 100+, Safari 16+

### Performance
- 24,426 stars rendered as Points with additive blending
- 7,408 jump connections as LineSegments
- Frustum culling disabled for stable performance
- Point size: 2.5px at 1080p

### Testing Strategy
- **Python unit tests**: Verify coordinate transforms and data processing
- **JavaScript unit tests**: Test bounds computation and binary parsing logic
- **Integration tests**: E2E browser tests with Playwright verifying full rendering pipeline

## Troubleshooting

### Black screen / No stars visible
1. Check debug panel for errors
2. Verify binary data files were generated: `npm run build:data`
3. Ensure `data/static.db` exists and has data
4. Check browser console for module resolution errors

### Import map errors
- Ensure browser supports import maps (Chrome 89+, Firefox 108+, Safari 16.4+)
- Check network tab for failed CDN requests

### Docker issues
- Ensure Docker daemon is running
- Check that data files exist in `public/data/` before building web image
- For data builder, verify volume mounts are correct

## License

MIT

## Credits

- three.js for 3D rendering
- EVE Online static data export for solar system coordinates
