/* Capture real mobile screenshots of the two invitations for the phone mockups.
   Sample 1: the golden cover (tap-to-open state) — what a guest first sees.
   Sample 2: the invitation hero after the seal opens. */
const { chromium } = require('playwright-core');

(async () => {
  const EXE = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
  const browser = await chromium.launch({ executablePath: EXE });
  const base = 'http://127.0.0.1:4200';

  // Phone-mockup screen is ~ (320px wide, 9:19) → capture at that aspect, 2x.
  const VW = 360, VH = 760;

  // ── Sample 1 invitation — cover state ──────────────────────────────
  console.log('Capturing sample 1 invitation (cover)...');
  const c1 = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const p1 = await c1.newPage();
  try {
    await p1.goto(`${base}/wedding-invite%20sample%201/index.html`, { waitUntil: 'networkidle', timeout: 30000 });
    await p1.waitForTimeout(3500); // petals + cover settle
    await p1.screenshot({ path: 'wedding-invite/assets/phone-invite.jpg', quality: 86, type: 'jpeg' });
    console.log('  saved wedding-invite/assets/phone-invite.jpg');
  } catch (e) { console.error('  sample1 failed:', e.message); }
  await c1.close();

  // ── Sample 2 invitation — hero after seal opens ────────────────────
  console.log('Capturing sample 2 invitation (hero)...');
  const c2 = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const p2 = await c2.newPage();
  try {
    await p2.goto(`${base}/3D%20Wedding%20Invitation%20Sample%202/invitation.html`, { waitUntil: 'networkidle', timeout: 45000 });
    await p2.waitForTimeout(4000);
    // open the seal if present so we see the real hero artwork
    const seal = await p2.$('#seal, .seal, [id*="seal"], .wax-seal, .seal-btn');
    if (seal) { await seal.click().catch(() => {}); await p2.waitForTimeout(3000); }
    await p2.evaluate(() => window.scrollTo(0, 0));
    await p2.waitForTimeout(800);
    await p2.screenshot({ path: '3D Wedding Invitation Sample 2/assets/stills/phone-invite.jpg', quality: 86, type: 'jpeg' });
    console.log('  saved 3D Wedding Invitation Sample 2/assets/stills/phone-invite.jpg');
  } catch (e) { console.error('  sample2 failed:', e.message); }
  await c2.close();

  await browser.close();
  console.log('Done.');
})();
