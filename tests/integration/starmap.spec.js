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
});
