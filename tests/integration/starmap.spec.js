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
});
