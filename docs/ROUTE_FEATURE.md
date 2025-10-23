# Route Visualization Feature

## Overview

The starmap now supports visualizing routes using bitpacked data passed via URL query parameter. Routes are rendered as cyan lines on the map with a draggable glassmorphic table showing waypoint details.

## Usage

### Basic Usage

Add a `route` query parameter with base64url-gzipped bitpacked data:

```
http://localhost:3000/public/?route={bitpacked-token}
```

### Creating Route Tokens

Use the included `bitpacking.js` (Node.js) to encode routes:

```javascript
const { encodeToBase64UrlGzip } = require('./src/bitpacking.js');

const waypoints = [
  { Id: 30000142, Type: 1 },  // Jita (Jump)
  { Id: 30002187, Type: 0 },  // Start
  { Id: 30000144, Type: 1 },  // Another jump
];

const token = encodeToBase64UrlGzip(waypoints);
console.log(`Route URL: ?route=${token}`);
```

### Waypoint Types

- **0** = Start
- **1** = Jump
- **2** = NPC Gate
- **3** = Smart Gate
- **4** = Set Destination

## Features

### Visual Rendering

- **Cyan line segments** connect waypoints in order
- **0.8 opacity** for clear visibility
- Lines render over jump gate network (orange lines)
- Invalid system IDs are filtered out automatically

### Persistent Labels

- **Focus label** (orange glassmorphism) - Shows the currently focused system
  - Created when clicking a system or using `?focus=` parameter
  - Updates automatically when navigating with browser back/forward buttons
  - Displays 🛰️ emoji for systems with NPC stations
  - Removed when navigating away from focused system
- **Route start label** (blue glassmorphism) - Shows 🚀 START marker
  - Automatically created for first waypoint in route
  - Blue gradient styling with cyan border
- **Route end label** (blue glassmorphism) - Shows 🏁 END marker  
  - Automatically created for last waypoint in route
  - Distinct from start if route has multiple waypoints

### Route Table UI

- **Cyan glassmorphism** design matching project aesthetic
- Displays:
  - Step number (1, 2, 3...)
  - Waypoint type (Start, Jump, NPC Gate, etc.)
  - System name (or "System {ID}" if name not found)
- Invalid systems shown in **red** with tooltip
- Header shows total waypoint count
- **Interactive features**:
  - **Click waypoints** to animate camera to that system
  - **Smooth camera transitions** with ease-in-out cubic easing (1 second duration)
  - **Drag to reposition** by clicking/dragging the header or background
  - **Position persists** in localStorage across sessions
  - **Hover effect** highlights clickable waypoints
  - **Browser navigation support** - back/forward buttons work correctly with focus parameter
- **OrbitControls disabled during drag** to prevent unwanted camera rotation
- Table stays within viewport bounds automatically

### Browser Navigation

- **Back/forward buttons** work seamlessly with the `?focus=` URL parameter
- **popstate event listener** updates camera position when navigating browser history
- **Animated transitions** when using back/forward (1 second ease-in-out)
- **Resets to initial view** when navigating back to URL without focus parameter
- **pushState updates** preserve browsing history when clicking systems or waypoints

### Draggable Interface

- Click and drag anywhere on the table header or background
- Table rows remain clickable for future interactions
- Position **persists** to localStorage
- Auto-repositions if dragged outside viewport
- Stays in bounds on window resize

### Position Persistence

The table position is saved to `localStorage.routeTablePosition` as JSON:
```json
{
  "top": 10,
  "right": 10
}
```

Position is restored on page reload and validated against viewport bounds.

## Data Format

The route token uses bit-tight encoding optimized for EVE Online system IDs:

1. **Header** (4 bytes):
   - Version: 1 byte (must be `1`)
   - Bit width `k`: 1 byte (auto-calculated based on max offset from 30,000,000)
   - Waypoint count: 2 bytes (big-endian uint16)

2. **Payload** (variable):
   - For each waypoint:
     - System ID offset: `k` bits (unsigned)
     - Waypoint type: 2 bits (0-3)

3. **Compression**: Gzipped with maximum compression
4. **Encoding**: Base64url (URL-safe, no padding)

## Browser Compatibility

Requires modern browsers with:
- **DecompressionStream API** (Chrome 80+, Firefox 113+, Safari 16.4+)
- ES6 modules
- async/await

## Examples

### Single waypoint route
```
?route={compressed-token}
```

### Combined with other features
```
?debug=true&focus=Jita&route={token}
```

The route table will appear even when focused on a specific system.

## Error Handling

- Invalid tokens show error in debug log (with `?debug=true`)
- App continues to function if route fails to decode
- Systems not in dataset are marked invalid but don't crash rendering
- Missing systems are filtered from line rendering

### Common Errors

**"Route token contains corrupted gzip data"**
- The token may be incomplete or truncated when copying
- Ensure the entire token is copied from start to finish
- Check for missing characters at the end
- Try regenerating the token if possible

**"Route token has invalid gzip header"**
- Token may be malformed or not actually gzipped
- Verify the token was generated with the correct encoding function
- Check for URL encoding issues (spaces, special chars)

**"Browser does not support route decompression"**
- Update to a modern browser:
  - Chrome 80+ (released Feb 2020)
  - Firefox 113+ (released May 2023)
  - Safari 16.4+ (released March 2023)
  - Edge 80+ (released Feb 2020)

### Testing Tokens

Before sharing route tokens, test them locally:

```bash
# Generate and test in one command
node -e "const {encodeToBase64UrlGzip} = require('./src/bitpacking.js'); const token = encodeToBase64UrlGzip([{Id:30000142,Type:1}]); console.log('Test URL: http://localhost:3000/public/?debug=true&route=' + token);"
```

Then visit the printed URL to verify it loads correctly.

## Development

### Testing Routes Locally

1. Create a test route with `bitpacking.js`:
   ```bash
   node -e "const bp = require('./src/bitpacking.js'); console.log(bp.encodeToBase64UrlGzip([{Id:30000142,Type:1},{Id:30002187,Type:0}]))"
   ```

2. Add to URL:
   ```
   http://localhost:3000/public/?debug=true&route={output}
   ```

3. Check debug panel for decoding messages

### File Structure

- `src/route-decoder.js` - Browser bitpacking decoder
- `src/bitpacking.js` - Node.js encoder (reference)
- `src/bitpacking.cs` - C# implementation (reference)
- Route rendering in `src/main.js` (`makeRouteLines()`)
- UI creation in `src/main.js` (`createRouteTable()`)
- Styles in `public/index.html` (`#route-table`)

## Future Enhancements

Potential improvements:
- Click waypoints to focus camera
- Hover waypoints to highlight route segment
- Edit/reorder waypoints
- Export modified routes
- Multiple route colors
- Route statistics (total jumps, distance)
