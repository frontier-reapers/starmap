# Deploying to Cloudflare Pages

This guide explains how to deploy the Starmap application to Cloudflare Pages.

## Prerequisites

1. **Cloudflare account** with Pages access
2. **GitHub repository** connected to your Cloudflare account

That's it! The build script automatically downloads the latest `static.db` from [evefrontier_datasets](https://github.com/Scetrov/evefrontier_datasets) during deployment.

## Cloudflare Pages Configuration

### Build Settings

When setting up your Cloudflare Pages project, use these build settings:

- **Framework preset**: None
- **Build command**: `./build.sh`
- **Build output directory**: `public`
- **Root directory**: `/` (leave empty or use root)

### Environment Variables

Set the following environment variable in your Cloudflare Pages project settings:

- **Python version**: `PYTHON_VERSION` = `3.12` (or higher)

To set this:
1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Environment variables**
3. Add `PYTHON_VERSION` with value `3.12`
4. Save changes

### Advanced Build Settings (Optional)

You can also configure these in your project settings:

- **Node.js version**: Automatically detected from `.nvmrc` file (18.x)
- **Build timeout**: Default (15 minutes) should be sufficient

## Deployment Steps

### Option 1: GitHub Integration (Recommended)

1. **Connect Repository**:
   - Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Go to **Pages** → **Create a project**
   - Select **Connect to Git**
   - Choose your GitHub repository

2. **Configure Build**:
   - **Project name**: `starmap` (or your preferred name)
   - **Production branch**: `main`
   - **Build command**: `./build.sh`
   - **Build output directory**: `public`

3. **Add Environment Variables**:
   - Click **Environment variables**
   - Add `PYTHON_VERSION` = `3.12`

4. **Deploy**:
   - Click **Save and Deploy**
   - Cloudflare Pages will build and deploy your site
   - Your site will be available at `https://starmap.pages.dev` (or your custom domain)

### Option 2: Direct Upload (Not Recommended)

Direct upload is not recommended because the build process requires Python to generate the binary data files. Use GitHub integration instead.

## Continuous Deployment

Once set up, Cloudflare Pages will automatically:
- Deploy on every push to `main` branch
- Create preview deployments for pull requests
- Download the latest `static.db` on each build
- Regenerate binary data files with latest EVE Online data

## Custom Domain

To use a custom domain:

1. Go to your Cloudflare Pages project
2. Navigate to **Custom domains**
3. Click **Set up a custom domain**
4. Follow the prompts to add your domain
5. Cloudflare will automatically provision an SSL certificate

## Troubleshooting

### Build Fails: "Could not find static.db in latest release"

**Root Cause**: The evefrontier_datasets repository may not have a database file in the latest release, or the filename has changed.

**Solution**: 
1. Check https://github.com/Scetrov/evefrontier_datasets/releases for available releases
2. The build script checks for both `static.db` and `static_data.db` filenames
3. If no release has the database file, download it manually and add to your repository:
   ```bash
   # Download manually from releases page
   git add -f data/static.db
   git commit -m "chore: add static.db fallback"
   git push
   ```
4. The build script will skip download if `data/static.db` already exists

### Build Fails: Download timeout

**Root Cause**: The `static.db` file is large (~200MB) and may timeout on slower connections.

**Solution**: Add the file to your repository as a fallback:
```bash
# Download manually first
curl -L -o data/static.db [DOWNLOAD_URL]
git add -f data/static.db
git commit -m "chore: add static.db for faster builds"
git push
```

### Build Fails: Python errors

**Solution**: Ensure `PYTHON_VERSION` environment variable is set to `3.12` or higher in your Cloudflare Pages project settings.

### Build Timeout

**Solution**: The default 15-minute timeout should be sufficient. If builds timeout:
- The download and build process typically takes 2-5 minutes
- If downloading `static.db` times out, add it to your repository as fallback
- Contact Cloudflare support to increase timeout limit if needed

### Binary files not updating after data source changes

**Solution**: The build script automatically downloads the latest `static.db` on each deployment, ensuring you always have the newest data. No manual updates needed!

## Build Process Details

The `build.sh` script performs these steps:

1. **Install Python dependencies** from `requirements.txt`
2. **Download latest static.db** from evefrontier_datasets GitHub releases (if not already present)
3. **Run data builder** (`build_data.py`) to generate:
   - `public/data/systems_positions.bin`
   - `public/data/systems_ids.bin`
   - `public/data/systems_names.json`
   - `public/data/jumps.bin`
   - `public/data/systems_with_stations.bin`
   - `public/data/manifest.json`
4. **Output to public/** directory for serving

## Performance Considerations

### Cloudflare Pages Benefits

- **Global CDN**: Assets served from 200+ locations worldwide
- **Automatic caching**: Static files cached at the edge
- **Compression**: Brotli/gzip compression enabled by default
- **HTTP/2 & HTTP/3**: Automatic protocol upgrades
- **Free SSL**: Automatic HTTPS with modern TLS

### Optimization Tips

1. **Binary files are already optimized** (bit-packed, gzip-compressed routes)
2. **Three.js loaded from CDN** (no bundle needed)
3. **No build step for JS** (ES6 modules work natively)

## Monitoring

Monitor your deployment:

1. **Analytics**: Cloudflare Pages provides built-in analytics
2. **Build logs**: View detailed build output in dashboard
3. **Web vitals**: Check performance metrics in Analytics tab

## Cost

Cloudflare Pages is **free** for:
- Unlimited sites
- Unlimited requests
- Unlimited bandwidth
- 500 builds per month
- 1 concurrent build

Paid plans available for more concurrent builds and advanced features.

## Security

Cloudflare Pages provides:
- **DDoS protection** included
- **Web Application Firewall (WAF)** available
- **Access control** for preview deployments
- **Custom headers** support

## Example Configuration File

If you prefer using a configuration file, create `.cloudflare/pages.json`:

```json
{
  "build": {
    "command": "./build.sh",
    "destination": "public"
  },
  "deployment": {
    "compatibility_date": "2024-01-01"
  }
}
```

## Support

For Cloudflare Pages specific issues:
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Support](https://support.cloudflare.com/)

## Alternative: Cloudflare Workers Sites

If you need dynamic features (backend API), consider:
- Cloudflare Workers for backend
- Cloudflare D1 for database
- Cloudflare R2 for object storage

This current setup is optimized for static hosting.
