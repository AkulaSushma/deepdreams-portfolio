/* Pre-deploy audit. Windows is case-insensitive, Vercel's CDN is not:
   a src="Assets/Logo.PNG" that works locally 404s in production. This walks
   every shipping HTML/CSS/JS file, resolves each local reference against the
   real filesystem with exact-case matching, and reports what would break. */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SKIP = new Set([
  "node_modules", ".git", ".vercel", ".claude", ".zcode",
  "_previous-design", "3d-world-source"
]);

/* ---- exact-case existence, cached per directory ---- */
const dirCache = new Map();
function listing(dir) {
  if (!dirCache.has(dir)) {
    try { dirCache.set(dir, new Set(fs.readdirSync(dir))); }
    catch { dirCache.set(dir, null); }
  }
  return dirCache.get(dir);
}
function existsExact(abs) {
  const rel = path.relative(ROOT, abs);
  if (rel.startsWith("..")) return "outside";
  let cur = ROOT;
  for (const seg of rel.split(path.sep)) {
    const l = listing(cur);
    if (!l) return "missing";
    if (!l.has(seg)) {
      const ci = [...l].find(n => n.toLowerCase() === seg.toLowerCase());
      return ci ? `case:${seg}->${ci}` : "missing";
    }
    cur = path.join(cur, seg);
  }
  return "ok";
}

/* ---- collect files to scan ---- */
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|css|js|json|webmanifest)$/i.test(e.name)) files.push(p);
  }
})(ROOT);

/* ---- reference extraction ---- */
const PATTERNS = [
  /(?:src|href)\s*=\s*["']([^"'>]+)["']/gi,          // html
  /url\(\s*["']?([^)"']+)["']?\s*\)/gi,               // css
  /["'`](\.{0,2}\/?[\w\-./ ]+\.(?:png|jpe?g|webp|gif|svg|mp4|webm|m4a|mp3|woff2?|json|js|css))["'`]/gi
];
const SKIP_REF = /^(https?:|data:|blob:|mailto:|tel:|whatsapp:|upi:|intent:|javascript:|#|\/\/)/i;

const missing = [], caseBug = [], absolute = [], localhost = [];
const seen = new Set();

for (const f of files) {
  const txt = fs.readFileSync(f, "utf8");
  const from = path.dirname(f);
  const relFile = path.relative(ROOT, f);

  if (/https?:\/\/(localhost|127\.0\.0\.1)/i.test(txt)) localhost.push(relFile);

  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(txt))) {
      let ref = m[1].trim();
      if (!ref || SKIP_REF.test(ref)) continue;
      ref = ref.split("#")[0].split("?")[0];
      if (!ref || ref.includes("${") || ref.includes("*")) continue;

      if (ref.startsWith("/")) { absolute.push(`${relFile}  ->  ${ref}`); continue; }

      const abs = path.resolve(from, decodeURIComponent(ref));
      const key = abs + "|" + relFile;
      if (seen.has(key)) continue;
      seen.add(key);

      const verdict = existsExact(abs);
      if (verdict === "missing") missing.push(`${relFile}  ->  ${ref}`);
      else if (verdict.startsWith("case:")) caseBug.push(`${relFile}  ->  ${ref}   [${verdict}]`);
    }
  }
}

const uniq = a => [...new Set(a)].sort();
const show = (title, arr, cap = 40) => {
  const u = uniq(arr);
  console.log(`\n=== ${title}: ${u.length} ===`);
  u.slice(0, cap).forEach(x => console.log("  " + x));
  if (u.length > cap) console.log(`  ... +${u.length - cap} more`);
};

console.log(`scanned ${files.length} files`);
show("BROKEN REFERENCES (404 in production)", missing);
show("CASE MISMATCH (works on Windows, 404 on Vercel)", caseBug);
show("ROOT-ABSOLUTE PATHS (break on subpath routes)", absolute, 25);
show("HARDCODED LOCALHOST", localhost);
