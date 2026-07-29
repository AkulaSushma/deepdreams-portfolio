/* Capture the real mobile view of wedding-invite/invite.html?demo
   for use inside the landing page phone mockup. */
const { chromium } = require('playwright-core');

(async () => {
  const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE });
  const base = 'http://127.0.0.1:4200';

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/wedding-invite/invite.html?demo`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    // Tap the cover to open the invitation
    const cover = await page.$('.cover-center, [aria-label*="Open"], .cover');
    if (cover) { await cover.click().catch(() => {}); await page.waitForTimeout(2500); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    // Save into the wedding-invite assets so the landing page can reference it
    await page.screenshot({ path: 'wedding-invite/assets/invite-mobile.jpg', quality: 86, type: 'jpeg' });
    console.log('saved wedding-invite/assets/invite-mobile.jpg');
  } catch (e) {
    console.error('capture failed:', e.message);
  }
  await ctx.close();
  await browser.close();
})();
