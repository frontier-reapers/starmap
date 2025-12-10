# Reapers Frontier Map

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

## Deployment

### Cloudflare Pages (Recommended)

Deploy to Cloudflare's global CDN for free hosting with automatic HTTPS:

1. **Connect to Cloudflare Pages**:
   - Build command: `./build.sh`
   - Build output: `public`
   - Environment variable: `PYTHON_VERSION=3.11`

The build script automatically downloads the latest `static.db` from [evefrontier_datasets](https://github.com/Scetrov/evefrontier_datasets/releases) - no manual setup required!

See [Cloudflare Pages Deployment Guide](./docs/CLOUDFLARE_PAGES.md) for complete instructions.

### Other Platforms

The application is a static site with a Python build step. Deploy to any platform that supports:
- Python 3.11+ for build step
- Static file hosting

Supported platforms: Vercel, Netlify, GitHub Pages (with GitHub Actions), AWS S3, etc.

## License

MIT

See [full documentation](./docs/README.md) for detailed information.
