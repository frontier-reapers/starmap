import { test, expect } from '@playwright/test';

test('capture production console + network', async ({ page }) => {
  const logs = [];
  const failures = [];

  page.on('console', (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    logs.push({ type: 'pageerror', text: err.message });
  });
  page.on('requestfailed', (req) => {
    failures.push({ url: req.url(), err: req.failure() ? req.failure().errorText : 'unknown' });
  });

  await page.goto('https://fmap.scetrov.live/?debug=true', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/prod-snapshot.png', fullPage: true });

  console.log('--- Console logs ---');
  for (const l of logs) console.log(l.type, l.text);
  console.log('--- Request failures ---');
  for (const f of failures) console.log(f.url, f.err);

  // Save logs to a file for inspection
  const fs = await import('fs');
  fs.writeFileSync('test-results/prod-console.log', JSON.stringify({ logs, failures }, null, 2));

  // Fail the test if there are request failures or a pageerror
  expect(failures.length, 'network failures').toBe(0);
  expect(logs.filter(l => l.type === 'pageerror').length, 'page errors').toBe(0);
});