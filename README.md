# Starmap (Three.js)

A 3D interactive star map visualization using three.js, rendering EVE Online solar system data with orbital controls and hover labels.

## Documentation

Full documentation is available in the [`docs/`](./docs/) folder:

- **[Main Documentation](./docs/README.md)** - Complete project documentation, architecture, and usage guide
- **[Migration Summary](./docs/MIGRATION_SUMMARY.md)** - Project structure migration details and setup instructions

## Quick Start

```bash
# Install dependencies
npm install

# Generate binary data files
npm run build:data

# Start development server
npm run dev
```

Open http://localhost:3000/public/ in your browser.

## Project Structure

```
starmap/
├── src/           # Application source code
├── public/        # Static assets and generated data
├── data/          # Data processing scripts
├── tests/         # Test suites (unit + integration)
├── docker/        # Docker configurations
├── docs/          # Documentation
└── .vscode/       # VS Code tasks
```

## VS Code Tasks

Press `Ctrl+Shift+P` → "Tasks: Run Task" to access:
- Start Dev Server
- Build Data from SQLite
- Run Tests (Unit/Integration/All)
- Docker Build & Run

## Docker

```bash
# Build and run web server
docker-compose up web

# Build data files
docker-compose --profile tools run data-builder
```

## License

MIT

See [full documentation](./docs/README.md) for detailed information.
