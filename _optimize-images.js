/* Re-encodes the oversized landing-page JPEGs in place, at the same filenames
   and the same format — so no HTML, CSS or config reference has to change and
   there is nothing to break. Originals are copied to _img-originals/ first.
   Uses headless Chrome's canvas encoder; no native image library required. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const JOBS = [
  { file: "assets/ai-lead-intake.jpg",    maxW: 1200, q: 0.78 },
  { file: "assets/ai-content-engine.jpg", maxW: 1200, q: 0.78 },
  { file: "assets/site-invite1.jpg",      maxW: 720,  q: 0.80 },
  { file: "assets/site-invite2.jpg",      maxW: 720,  q: 0.80 }
];

const BACKUP = "_img-originals";

(async () => {
  fs.mkdirSync(BACKUP, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();

  for (const job of JOBS) {
    const before = fs.statSync(job.file).size;
    const bak = path.join(BACKUP, path.basename(job.file));
    if (!fs.existsSync(bak)) fs.copyFileSync(job.file, bak);

    const dataUrl = "data:image/jpeg;base64," + fs.readFileSync(bak).toString("base64");
    const out = await page.evaluate(async ({ dataUrl, maxW, q }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      return { data: c.toDataURL("image/jpeg", q).split(",")[1], w: c.width, h: c.height };
    }, { dataUrl, maxW: job.maxW, q: job.q });

    const buf = Buffer.from(out.data, "base64");
    if (buf.length >= before) { console.log(`${job.file}: skipped (no gain)`); continue; }
    fs.writeFileSync(job.file, buf);
    const kb = n => (n / 1024).toFixed(0) + "KB";
    console.log(`${path.basename(job.file).padEnd(24)} ${kb(before).padStart(6)} -> ${kb(buf.length).padStart(6)}  (${out.w}x${out.h})  -${(100 - buf.length / before * 100).toFixed(0)}%`);
  }
  await browser.close();
})();
