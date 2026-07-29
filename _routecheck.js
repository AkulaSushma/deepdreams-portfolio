/* Loads every shipping route headlessly and reports what a real visitor's
   browser would hit: uncaught JS errors, console errors, and failed/404
   requests. Static analysis can't see these — they only appear at runtime. */
const { chromium } = require("playwright-core");

const BASE = "http://127.0.0.1:4200";
const ROUTES = [
  "/index.html",
  "/wedding-invite%20sample%201/index.html",
  "/wedding-invite%20sample%201/invite.html",
  "/3D%20Wedding%20Invitation%20Sample%202/index.html",
  "/3D%20Wedding%20Invitation%20Sample%202/invitation.html",
  "/3D%20Wedding%20Invitation%20Sample%202/create.html",
  "/3D%20Wedding%20Invitation%20Sample%202/world/index.html"
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [], bad = [];

    page.on("pageerror", e => errs.push("UNCAUGHT: " + e.message.split("\n")[0]));
    page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text().slice(0, 160)); });
    page.on("requestfailed", r => bad.push(`${r.failure()?.errorText} ${r.url().replace(BASE, "")}`));
    page.on("response", r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(BASE, "")}`); });

    let status = "?";
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
      status = resp ? resp.status() : "no-response";
      /* let deferred work run: lazy media, carousels, canvas engines */
      await page.waitForTimeout(3500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2500);
    } catch (e) {
      errs.push("NAV: " + e.message.split("\n")[0]);
    }

    const uniq = a => [...new Set(a)];
    console.log(`\n### ${route}  [${status}]`);
    const e = uniq(errs), b = uniq(bad);
    if (!e.length && !b.length) console.log("   clean");
    e.slice(0, 12).forEach(x => console.log("   " + x));
    b.slice(0, 12).forEach(x => console.log("   NET " + x));
    if (e.length > 12) console.log(`   ...+${e.length - 12} errors`);
    if (b.length > 12) console.log(`   ...+${b.length - 12} net`);
    await ctx.close();
  }
  await browser.close();
})();
