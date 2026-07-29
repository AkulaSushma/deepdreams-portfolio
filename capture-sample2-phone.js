/* Capture the real Sample 2 invitation hero (past the seal) for the phone mock. */
const { chromium } = require('playwright-core');

(async () => {
  const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE });
  const base = 'http://127.0.0.1:4200';

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/3D%20Wedding%20Invitation%20Sample%202/invitation.html`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Open the seal (the button the guest taps)
    const seal = await page.$('#seal-btn');
    if (seal) { await seal.click().catch(() => {}); }
    await page.waitForTimeout(6000);            // doors open + frames stream in
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);

    await page.screenshot({ path: '3D Wedding Invitation Sample 2/assets/phone-screenshot.jpg', quality: 86, type: 'jpeg' });
    console.log('saved phone-screenshot.jpg');
  } catch (e) {
    console.error('capture failed:', e.message);
  }
  await ctx.close();
  await browser.close();
})();
