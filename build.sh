#!/bin/bash
# Build script for Cloudflare Pages deployment
# This script is executed during the Cloudflare Pages build process

set -e

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Downloading static.db from evefrontier_datasets..."
if [ ! -f "data/static.db" ]; then
    echo "Fetching latest release URL..."
    LATEST_RELEASE=$(curl -s https://api.github.com/repos/Scetrov/evefrontier_datasets/releases/latest)
    
    # Try both possible filenames: static_data.db (current) and static.db (legacy)
    DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": *"[^"]*"' | grep -E '(static\.db|static_data\.db)' | head -1 | cut -d'"' -f4)
    
    if [ -z "$DOWNLOAD_URL" ]; then
        echo "ERROR: Could not find static.db or static_data.db in latest release!"
        echo "Please check https://github.com/Scetrov/evefrontier_datasets/releases"
        exit 1
    fi
    
    echo "Downloading from: $DOWNLOAD_URL"
    curl -L -o data/static.db "$DOWNLOAD_URL"
    
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
python data/build_data.py --db data/static.db --out public/data

echo "Copying source files to public directory..."
cp -r src public/

echo "Build complete!"
echo "Output directory: public/"
