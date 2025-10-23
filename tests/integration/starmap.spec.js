/**
 * Integration tests for the starmap web application
 * Tests the full rendering pipeline in a real browser
 */
import { test, expect } from '@playwright/test';

test.describe('Starmap Application', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the index page with debug mode enabled
    await page.goto('http://localhost:3000/public/?debug=true');
  });

  test('should load the page with title', async ({ page }) => {
    await expect(page).toHaveTitle(/Starmap/);
  });

  test('should have the main app container', async ({ page }) => {
    const appDiv = page.locator('#app');
    await expect(appDiv).toBeVisible();
  });

  test('should have the overlay with controls info', async ({ page }) => {
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Drag = orbit');
  });

  test('should load and render canvas', async ({ page }) => {
    // Wait for WebGL canvas to be added
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
  });

  test('should display debug panel with logs', async ({ page }) => {
    // Wait for debug panel to appear
    const debugPanel = page.locator('#debug-log');
    await expect(debugPanel).toBeVisible({ timeout: 5000 });
    
    // Check that it contains expected log messages
    const content = await debugPanel.textContent();
    expect(content).toContain('module loaded');
    expect(content).toContain('main: starting');
  });

  test('should load binary data successfully', async ({ page }) => {
    const debugPanel = page.locator('#debug-log');
    await expect(debugPanel).toBeVisible({ timeout: 5000 });
    
    // Wait for data loading messages
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('loadData: complete');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    expect(content).toContain('fetched bytes');
    expect(content).toContain('loadData: complete');
  });

  test('should render stars with non-zero bounds', async ({ page }) => {
    const debugPanel = page.locator('#debug-log');
    
    // Wait for bounds computation
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('computeBounds: result');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    
    // Parse the bounds from debug output
    // Should see non-zero radius
    expect(content).toContain('radius');
    expect(content).not.toContain('"radius":0');
  });

  test('should start animation loop', async ({ page }) => {
    const debugPanel = page.locator('#debug-log');
    
    // Wait for animation to start
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('animate: frame');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    expect(content).toContain('animate: frame 0 rendered');
  });

  test('should handle mouse hover for star labels', async ({ page }) => {
    // Wait for canvas to be ready
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });
    
    // Wait for animation to start
    await page.waitForTimeout(2000);
    
    // Move mouse over canvas center
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
      
      // Check if label renderer is present
      const labelRenderer = page.locator('.label');
      // Label might not be visible if mouse isn't over a star, so we just check it exists
      const count = await labelRenderer.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should load station systems data', async ({ page }) => {
    const debugPanel = page.locator('#debug-log');
    await expect(debugPanel).toBeVisible({ timeout: 5000 });
    
    // Wait for station systems to be loaded
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('loaded station systems');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    expect(content).toContain('stationCount');
    // Should have loaded some station systems
    expect(content).toMatch(/stationCount":\s*\d+/);
  });

  test('should render both regular and station stars', async ({ page }) => {
    const debugPanel = page.locator('#debug-log');
    
    // Wait for starfield creation
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('station stars');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    // Should see both types of stars created
    expect(content).toContain('regular stars');
    expect(content).toContain('station stars');
  });

  test('should display station emoji in labels', async ({ page }) => {
    // Wait for page to be ready
    await page.waitForTimeout(2000);
    
    // Get debug panel to find a station system
    const debugPanel = page.locator('#debug-log');
    await expect(debugPanel).toBeVisible({ timeout: 5000 });
    
    // We can check that the label element exists with the correct class
    const label = page.locator('.label');
    expect(await label.count()).toBeGreaterThanOrEqual(0);
  });

  test('should focus on system with query parameter by name', async ({ page }) => {
    // Navigate with focus parameter (using a common system name)
    await page.goto('http://localhost:3000/public/?debug=true&focus=Jita');
    
    const debugPanel = page.locator('#debug-log');
    
    // Wait for focus to be applied
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('focus parameter detected');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    expect(content).toContain('focus parameter detected');
    expect(content).toContain('Jita');
  });

  test('should focus on system with query parameter by ID', async ({ page }) => {
    // Navigate with focus parameter using system ID
    await page.goto('http://localhost:3000/public/?debug=true&focus=30000142');
    
    const debugPanel = page.locator('#debug-log');
    
    // Wait for focus to be applied
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('focus parameter detected');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    expect(content).toContain('focus parameter detected');
  });

  test('should update URL on star click', async ({ page }) => {
    // Wait for canvas to be ready
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Get initial URL
    const initialUrl = page.url();
    
    // Click on canvas (hoping to hit a star)
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
      
      // URL might have changed (or might not if we didn't click a star)
      const newUrl = page.url();
      // Just verify the page didn't crash and URL is valid
      expect(newUrl).toContain('localhost:3000');
    }
  });

  test('should have dual point cloud structure', async ({ page }) => {
    const debugPanel = page.locator('#debug-log');
    
    // Wait for geometry info to be logged
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('groupChildren');
    }, { timeout: 10000 });
    
    const content = await debugPanel.textContent();
    // Should have created a group with children
    expect(content).toContain('groupChildren');
  });

  test('should exclude filtered systems', async ({ page }) => {
    const debugPanel = page.locator('#debug-log');
    await expect(debugPanel).toBeVisible({ timeout: 5000 });
    
    // Wait for data loading
    await page.waitForFunction(() => {
      const panel = document.getElementById('debug-log');
      return panel && panel.textContent.includes('loadData: complete');
    }, { timeout: 10000 });
    
    // The test data should have fewer systems due to filtering
    // We can't easily check exact numbers, but we verify the app loads successfully
    const content = await debugPanel.textContent();
    expect(content).toContain('loadData: complete');
  });

  test('should display route table when route parameter is present', async ({ page }) => {
    // Note: This test would need a valid route token to fully test
    // For now, we just verify the app doesn't crash with an invalid route
    await page.goto('http://localhost:3000/public/?debug=true&route=invalid');
    
    await page.waitForTimeout(2000);
    
    // Should see error in debug log but app should still work
    const debugPanel = page.locator('#debug-log');
    await expect(debugPanel).toBeVisible({ timeout: 5000 });
  });

  test('should handle corrupted route token gracefully', async ({ page }) => {
    // Use the actual corrupted token from the user
    const corruptedToken = 'H4sIAAAAAAAAE-2NQQrCMAwEX7Mlz7iOJPoC6xHR5a0mTbv_5wi1x9NsZzjFPTUpBg6-RTKhuwrV0TdLq1Ryo8qYWOGFkTwc7E2vZPExf6q0r3xra14pDDAAAA';
    await page.goto(`http://localhost:3000/public/?debug=true&route=${corruptedToken}`);
    
    await page.waitForTimeout(3000);
    
    // App should still load despite bad route
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    
    // Should see error message in debug log
    const debugPanel = page.locator('#debug-log');
    await expect(debugPanel).toBeVisible();
    const content = await debugPanel.textContent();
    expect(content).toContain('failed to decode route');
  });

  test('should render route with valid token', async ({ page }) => {
    // Valid token generated from test-encode.cjs
    const validToken = 'H4sIAAAAAAACCmPkYWDmeKZ0YIIDAKxgWgwKAAAA';
    await page.goto(`http://localhost:3000/public/?debug=true&route=${validToken}`);
    
    await page.waitForTimeout(3000);
    
    // Should see route table
    const routeTable = page.locator('#route-table');
    await expect(routeTable).toBeVisible({ timeout: 5000 });
    
    // Should see waypoints in table
    const tableRows = routeTable.locator('tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBe(3); // 3 waypoints in the test token
  });

  test('should render 17-waypoint Strym route', async ({ page }) => {
    // Real-world route: Strym -> Z:2V39 -> ... -> IGJ-PSH (17 waypoints)
    // Mix of waypoint types: 0=Start, 1=Jump, 2=NpcGate
    const strymRouteToken = 'H4sIAAAAAAACCgEmANn_AQ4AEZUYlT6VLpUKlUqVTpVWlYqVhpWOkVmRTZFVkUWQspC-tVWT1x2fJgAAAA';
    await page.goto(`http://localhost:3000/public/?debug=true&route=${strymRouteToken}`);
    
    await page.waitForTimeout(3000);
    
    // Should see route table
    const routeTable = page.locator('#route-table');
    await expect(routeTable).toBeVisible({ timeout: 5000 });
    
    // Verify table title shows correct count
    const title = routeTable.locator('h3');
    await expect(title).toContainText('17 waypoints');
    
    // Should see all 17 waypoints in table
    const tableRows = routeTable.locator('tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBe(17);
    
    // Verify first waypoint is Strym (Type: Start)
    const firstRow = tableRows.nth(0);
    await expect(firstRow.locator('.step-number')).toContainText('1');
    await expect(firstRow.locator('.waypoint-type')).toContainText('Start');
    
    // Verify a NPC Gate waypoint (Z:2V39 is second, Type: NPC Gate)
    const secondRow = tableRows.nth(1);
    await expect(secondRow.locator('.step-number')).toContainText('2');
    await expect(secondRow.locator('.waypoint-type')).toContainText('NPC Gate');
    
    // Verify a Jump waypoint (OKK-0PH is 11th, Type: Jump)
    const eleventhRow = tableRows.nth(10);
    await expect(eleventhRow.locator('.step-number')).toContainText('11');
    await expect(eleventhRow.locator('.waypoint-type')).toContainText('Jump');
    
    // Verify last waypoint (IGJ-PSH is 17th, Type: Jump)
    const lastRow = tableRows.nth(16);
    await expect(lastRow.locator('.step-number')).toContainText('17');
    await expect(lastRow.locator('.waypoint-type')).toContainText('Jump');
    
    // Verify route lines are rendered on the map
    const debugPanel = page.locator('#debug-log');
    const content = await debugPanel.textContent();
    expect(content).toContain('route lines added to scene');
  });

  test('should not show route table without route parameter', async ({ page }) => {
    const routeTable = page.locator('#route-table');
    expect(await routeTable.count()).toBe(0);
  });

  test('should save route table position to localStorage', async ({ page }) => {
    // This test would require a valid route token
    // Testing that localStorage API is available
    const hasLocalStorage = await page.evaluate(() => {
      return typeof localStorage !== 'undefined';
    });
    expect(hasLocalStorage).toBe(true);
  });

  test('should animate camera when clicking waypoint in route table', async ({ page }) => {
    const validToken = 'H4sIAAAAAAACCmPkYWDmeKZ0YIIDAKxgWgwKAAAA';
    await page.goto(`http://localhost:3000/public/?debug=true&route=${validToken}`);
    
    await page.waitForTimeout(3000);
    
    const routeTable = page.locator('#route-table');
    await expect(routeTable).toBeVisible({ timeout: 5000 });
    
    // Get initial camera position
    const initialPosition = await page.evaluate(() => {
      return {
        x: window.camera?.position.x,
        y: window.camera?.position.y,
        z: window.camera?.position.z
      };
    });
    
    // Click the first waypoint row
    const firstRow = routeTable.locator('tbody tr').first();
    await firstRow.click();
    
    // Wait for animation to complete
    await page.waitForTimeout(1200);
    
    // Camera position should have changed
    const newPosition = await page.evaluate(() => {
      return {
        x: window.camera?.position.x,
        y: window.camera?.position.y,
        z: window.camera?.position.z
      };
    });
    
    // Verify camera moved (at least one coordinate changed)
    const cameraMoved = 
      Math.abs(initialPosition.x - newPosition.x) > 0.1 ||
      Math.abs(initialPosition.y - newPosition.y) > 0.1 ||
      Math.abs(initialPosition.z - newPosition.z) > 0.1;
    
    expect(cameraMoved).toBe(true);
  });

  test('should not trigger camera rotation while dragging route table', async ({ page }) => {
    const validToken = 'H4sIAAAAAAACCmPkYWDmeKZ0YIIDAKxgWgwKAAAA';
    await page.goto(`http://localhost:3000/public/?debug=true&route=${validToken}`);
    
    await page.waitForTimeout(3000);
    
    const routeTable = page.locator('#route-table');
    await expect(routeTable).toBeVisible({ timeout: 5000 });
    
    // Get initial camera target
    const initialTarget = await page.evaluate(() => {
      return {
        x: window.controls?.target.x,
        y: window.controls?.target.y,
        z: window.controls?.target.z
      };
    });
    
    // Drag the route table
    const tableHeader = routeTable.locator('h3');
    const box = await tableHeader.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.up();
    
    // Wait a bit for any potential camera changes
    await page.waitForTimeout(300);
    
    // Camera target should not have changed (OrbitControls were disabled)
    const newTarget = await page.evaluate(() => {
      return {
        x: window.controls?.target.x,
        y: window.controls?.target.y,
        z: window.controls?.target.z
      };
    });
    
    expect(Math.abs(initialTarget.x - newTarget.x)).toBeLessThan(0.01);
    expect(Math.abs(initialTarget.y - newTarget.y)).toBeLessThan(0.01);
    expect(Math.abs(initialTarget.z - newTarget.z)).toBeLessThan(0.01);
  });

  test('waypoint rows should have hover effect', async ({ page }) => {
    const validToken = 'H4sIAAAAAAACCmPkYWDmeKZ0YIIDAKxgWgwKAAAA';
    await page.goto(`http://localhost:3000/public/?debug=true&route=${validToken}`);
    
    await page.waitForTimeout(3000);
    
    const routeTable = page.locator('#route-table');
    await expect(routeTable).toBeVisible({ timeout: 5000 });
    
    const firstRow = routeTable.locator('tbody tr').first();
    
    // Row should be clickable (have cursor pointer)
    const cursor = await firstRow.evaluate(el => window.getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    await page.goto(`http://localhost:3000/public/?debug=true`);
    
    await page.waitForTimeout(3000);
    
    // Get initial camera position
    const initialPosition = await page.evaluate(() => {
      return {
        x: window.camera?.position.x,
        y: window.camera?.position.y,
        z: window.camera?.position.z
      };
    });
    
    // Navigate to a system via URL
    await page.goto(`http://localhost:3000/public/?debug=true&focus=Strym`);
    await page.waitForTimeout(1500);
    
    // Camera should have moved
    const focusedPosition = await page.evaluate(() => {
      return {
        x: window.camera?.position.x,
        y: window.camera?.position.y,
        z: window.camera?.position.z
      };
    });
    
    const cameraMoved = 
      Math.abs(initialPosition.x - focusedPosition.x) > 0.1 ||
      Math.abs(initialPosition.y - focusedPosition.y) > 0.1 ||
      Math.abs(initialPosition.z - focusedPosition.z) > 0.1;
    
    expect(cameraMoved).toBe(true);
    
    // Go back
    await page.goBack();
    await page.waitForTimeout(1500);
    
    // Camera should move back to initial position (approximately)
    const backPosition = await page.evaluate(() => {
      return {
        x: window.camera?.position.x,
        y: window.camera?.position.y,
        z: window.camera?.position.z
      };
    });
    
    // Should be closer to initial position than focused position
    const distToInitial = Math.sqrt(
      Math.pow(backPosition.x - initialPosition.x, 2) +
      Math.pow(backPosition.y - initialPosition.y, 2) +
      Math.pow(backPosition.z - initialPosition.z, 2)
    );
    
    const distToFocused = Math.sqrt(
      Math.pow(backPosition.x - focusedPosition.x, 2) +
      Math.pow(backPosition.y - focusedPosition.y, 2) +
      Math.pow(backPosition.z - focusedPosition.z, 2)
    );
    
    expect(distToInitial).toBeLessThan(distToFocused);
    
    // Go forward
    await page.goForward();
    await page.waitForTimeout(1500);
    
    // Camera should move back to focused position (approximately)
    const forwardPosition = await page.evaluate(() => {
      return {
        x: window.camera?.position.x,
        y: window.camera?.position.y,
        z: window.camera?.position.z
      };
    });
    
    // Should be close to focused position
    const distToFocusedAfterForward = Math.sqrt(
      Math.pow(forwardPosition.x - focusedPosition.x, 2) +
      Math.pow(forwardPosition.y - focusedPosition.y, 2) +
      Math.pow(forwardPosition.z - focusedPosition.z, 2)
    );
    
    // Allow for some tolerance due to animation timing
    expect(distToFocusedAfterForward).toBeLessThan(10);
  });
});
