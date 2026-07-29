const { chromium } = require('playwright-core');
(async () => {
  const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext();
  const tests = [
    { name: 'SAMPLE 1', url: 'http://127.0.0.1:4200/wedding-invite%20sample%201/index.html' },
    { name: 'SAMPLE 2', url: 'http://127.0.0.1:4200/3D%20Wedding%20Invitation%20Sample%202/index.html' },
  ];
  for (const t of tests) {
    const page = await ctx.newPage();
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + '  ' + r.url()); });
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(()=>{});
    await page.waitForTimeout(1500);
    console.log(`### ${t.name}`);
    bad.forEach(b => console.log('  ' + b));
    console.log('');
    await page.close();
  }
  await ctx.close(); await browser.close();
})();
