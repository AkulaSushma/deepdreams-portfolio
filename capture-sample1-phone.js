/* Capture a real mobile screenshot of Sample 1's opened invitation,
   cropped to a phone-screen aspect (9:16-ish) for the landing page phone mock. */
const { chromium } = require('playwright-core');

(async () => {
  const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE });
  const base = 'http://127.0.0.1:4200';

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/wedding-invite%20sample%201/invite.html?demo`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2500);
    // Open the cover if present
    const coverBtn = await page.$('.cover-center, [aria-label*="Open"], .cover, #openBtn, .open-btn');
    if (coverBtn) { await coverBtn.click().catch(() => {}); await page.waitForTimeout(2600); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'wedding-invite sample 1/assets/phone-screenshot.jpg', quality: 86, type: 'jpeg' });
    console.log('saved wedding-invite sample 1/assets/phone-screenshot.jpg');
  } catch (e) {
    console.error('capture failed:', e.message);
  }
  await ctx.close();
  await browser.close();
})();
