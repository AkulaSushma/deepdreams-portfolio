const { chromium } = require('playwright-core');
(async () => {
  const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const tests = [
    { name: 'MAIN SITE', url: 'http://127.0.0.1:4200/index.html' },
    { name: 'SAMPLE 1',  url: 'http://127.0.0.1:4200/wedding-invite%20sample%201/index.html' },
    { name: 'SAMPLE 2',  url: 'http://127.0.0.1:4200/3D%20Wedding%20Invitation%20Sample%202/index.html' },
  ];

  for (const t of tests) {
    const page = await ctx.newPage();
    const failed = [];
    page.on('requestfailed', r => failed.push(r.url().split('?')[0].split('/').pop()));
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().split('?')[0].split('/').pop()); });
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.log('nav err', e.message));
    await page.waitForTimeout(2500);
    const res = await page.evaluate(() => {
      const el = document.body;
      const cs = getComputedStyle(el);
      // a styled site will have a non-default background or custom font
      const styled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || /Garamond|Cinzel|Inter|Vibes/i.test(cs.fontFamily);
      return {
        title: document.title,
        bodyBg: cs.backgroundColor,
        font: cs.fontFamily.slice(0, 45),
        appearsStyled: styled,
        firstText: el.innerText.slice(0, 70).replace(/\s+/g, ' ')
      };
    });
    console.log(`### ${t.name}`);
    console.log(JSON.stringify(res));
    console.log('failed/404 requests:', failed.length ? failed.join(', ') : 'none');
    console.log('');
    await page.close();
  }
  await ctx.close(); await browser.close();
})();
