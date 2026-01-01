#!/bin/bash
# Build script for Cloudflare Pages deployment
# This script is executed during the Cloudflare Pages build process

set -e

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Downloading static.db from evefrontier_datasets..."
if [ ! -f "data/static.db" ]; then
    echo "Fetching latest release info..."

    # Allow callers to override the dataset source to avoid GitHub API or naming issues
    if [ -n "$STATIC_DB_URL" ]; then
        echo "Using STATIC_DB_URL override: $STATIC_DB_URL"
        DOWNLOAD_URL="$STATIC_DB_URL"
        RELEASE_TAG="(override)"
    else
        RELEASE_INFO=$(curl -s https://api.github.com/repos/Scetrov/evefrontier_datasets/releases/latest || true)

        # Prefer jq if available for robust parsing
        if command -v jq >/dev/null 2>&1; then
            DOWNLOAD_URL=$(echo "$RELEASE_INFO" | jq -r '.assets[] | select(.name | test("static(_data)?\\.db")) | .browser_download_url' | head -1)
            RELEASE_TAG=$(echo "$RELEASE_INFO" | jq -r '.tag_name // .name // empty')
        else
            # Fallback to grep-based parsing
            DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep -o '"browser_download_url": *"[^"]*"' | grep -E '(static\.db|static_data\.db)' | head -1 | cut -d'"' -f4 || true)
            RELEASE_TAG=$(echo "$RELEASE_INFO" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4 || true)
        fi

        if [ -z "$DOWNLOAD_URL" ]; then
            echo "ERROR: Could not find static.db or static_data.db in latest release (rate limit or naming change?)."
            echo "You can set the environment variable STATIC_DB_URL to a direct download URL or set RELEASE_TAG manually."
            echo "Release info preview:"; echo "$RELEASE_INFO" | head -n 20
            exit 1
        fi

        echo "Detected release: $RELEASE_TAG"
        echo "Downloading dataset from: $DOWNLOAD_URL"
        curl -L -o data/static.db "$DOWNLOAD_URL"
    fi
    
    if [ ! -f "data/static.db" ]; then
        echo "ERROR: Download failed!"
        exit 1
    fi
    
    FILE_SIZE=$(stat -f%z "data/static.db" 2>/dev/null || stat -c%s "data/static.db" 2>/dev/null)
    echo "Download complete! Size: $((FILE_SIZE / 1024 / 1024)) MB"
else
    echo "static.db already exists, skipping download"
fi

echo "Building data files..."
echo "Generating build-info and building data files..."
# Generate build-info (commit) for cache-busting in builds
echo "Node version: $(node -v 2>/dev/null || echo 'node not found')"
echo "Python version: $(python -V 2>&1 || echo 'python not found')"
node build-info.js

if [ -f public/build-info.json ]; then
    echo "public/build-info.json contents:"
    cat public/build-info.json
else
    echo "ERROR: public/build-info.json not found after running build-info.js"
    exit 1
fi

python data/build_data.py --db data/static.db --out public/data

if [ -f public/data/manifest.json ]; then
    echo "public/data/manifest.json contents:"
    cat public/data/manifest.json
else
    echo "ERROR: public/data/manifest.json not found after building data"
    exit 1
fi

# If we detected a RELEASE_TAG, pass it into manifest (helpful for CI workflows)
if [ -n "$RELEASE_TAG" ] && [ "$RELEASE_TAG" != "(override)" ]; then
    echo "Re-running build to ensure manifest contains RELEASE_TAG=$RELEASE_TAG"
    python data/build_data.py --db data/static.db --out public/data --release "$RELEASE_TAG"
    echo "Updated manifest:"; cat public/data/manifest.json
fi

echo "Copying source files to public directory..."
cp -r src public/

echo "Build complete!"
echo "Output directory: public/"
