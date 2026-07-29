const { chromium } = require('playwright-core');
(async () => {
  const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE });
  const base = 'http://127.0.0.1:4200';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${base}/3D%20Wedding%20Invitation%20Sample%202/invitation.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => ({
    bodyClass: document.body.className,
    loader: !!document.querySelector('.loader, #loader, [class*="loader"]'),
  }));
  console.log('before click:', JSON.stringify(before));
  const seal = await page.$('.seal, #seal, .seal-btn, .cover-center, .gateway, .enter');
  if (seal) await seal.click().catch(()=>{});
  await page.waitForTimeout(4500);
  const after = await page.evaluate(() => {
    const hero = document.querySelector('.hero, #hero');
    const r = hero ? hero.getBoundingClientRect() : null;
    return {
      bodyClass: document.body.className,
      heroRect: r ? { top: r.top, h: r.height } : null,
      scrollY: window.scrollY,
    };
  });
  console.log('after click:', JSON.stringify(after));
  await ctx.close(); await browser.close();
})();
