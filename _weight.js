/* What a real visitor actually downloads. Total repo size is irrelevant to
   speed — this measures bytes over the wire for a first load, which is what
   decides whether the site feels instant on an Indian mobile connection and
   what the monthly bandwidth bill looks like at scale. */
const { chromium } = require("playwright-core");
const BASE = "http://127.0.0.1:4200";

const ROUTES = [
  ["landing", "/index.html"],
  ["invitation", "/3D%20Wedding%20Invitation%20Sample%202/invitation.html"],
  ["3d world", "/3D%20Wedding%20Invitation%20Sample%202/world/index.html"]
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  for (const [name, route] of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    let firstParty = 0, thirdParty = 0;
    const byType = {};

    page.on("response", async r => {
      try {
        const len = Number((await r.allHeaders())["content-length"] || 0);
        if (!len) return;
        if (r.url().startsWith(BASE)) {
          firstParty += len;
          const ext = (r.url().split("?")[0].split(".").pop() || "?").slice(0, 5);
          byType[ext] = (byType[ext] || 0) + len;
        } else thirdParty += len;
      } catch {}
    });

    await page.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(4000);          // idle first paint
    const initial = firstParty;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(6000);          // full scroll-through

    const mb = b => (b / 1048576).toFixed(2) + " MB";
    const top = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => `${k} ${mb(v)}`).join(", ");
    console.log(`${name.padEnd(11)} first paint ${mb(initial).padStart(9)} | full scroll ${mb(firstParty).padStart(9)} | 3rd-party ${mb(thirdParty)}`);
    console.log(`            ${top}`);
    await ctx.close();
  }
  await browser.close();
})();
