/* Throwaway smoke test for the pure functions in api/_lib. Deleted after use. */
process.env.TOKEN_PEPPER = "test-pepper";
process.env.ADMIN_SESSION_SECRET = "test-secret-value-long-enough";
process.env.ADMIN_PASSWORD = "correct horse battery staple";
process.env.SUPABASE_URL = "https://abcd.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "service-key";

const t = require("./tokens");
const r = require("./render");
const pv = require("./public-view");
const auth = require("./auth");
const http = require("./http");

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) { fails++; console.log("FAIL", name, extra === undefined ? "" : extra); }
  else console.log("pass", name);
};

/* ── tokens ─────────────────────────────────────────────────────────────── */
const code = t.generate();
ok("token format", /^DD(-[0-9A-HJKMNP-TV-Z]{5}){3}$/.test(code), code);
ok("no ambiguous chars", !/[ILOU]/.test(code.slice(3)), code);
ok("normalise idempotent", t.normalise(code) === code);
ok("normalise lowercase+spaces", t.normalise(code.toLowerCase().replace(/-/g, " ")) === code);
ok("normalise without prefix", t.normalise(code.slice(3)) === code);
ok("O maps to 0", t.normalise("DD-OOOOO-11111-22222") === "DD-00000-11111-22222");
ok("l maps to 1", t.normalise("dd-lllll-11111-22222") === "DD-11111-11111-22222");
ok("rejects short", t.normalise("DD-ABC") === "");
ok("rejects rubbish", t.normalise("") === "" && t.normalise(null) === "");
ok("looksValid", t.looksValid(code) && !t.looksValid("nope"));

const h1 = t.hash(code), h2 = t.hash(code.toLowerCase());
ok("hash stable across formatting", h1 === h2 && h1.length === 64);
ok("hash differs per token", t.hash(t.generate()) !== h1);
ok("hash uses pepper", (() => {
  const prev = process.env.TOKEN_PEPPER;
  process.env.TOKEN_PEPPER = "different";
  const other = t.hash(code);
  process.env.TOKEN_PEPPER = prev;
  return other !== h1;
})());

const d = t.draftId(h1);
ok("draftId stable", d === t.draftId(h1) && d.length === 24);
ok("draftId is not the token hash", !h1.startsWith(d));

const slug = t.makeSlug("Priya", "Karthik");
ok("slug shape", /^priya-karthik-[a-z0-9]{4}$/.test(slug), slug);
ok("slug accents", t.makeSlug("José", "Chloë").startsWith("jose-chloe"), t.makeSlug("José", "Chloë"));
ok("slug non-latin fallback", t.makeSlug("ప్రియ", "కార్తీక్").startsWith("wedding-"), t.makeSlug("ప్రియ", "కార్తీక్"));
ok("slug strips punctuation", t.makeSlug("A & B!!", "C/D").startsWith("a-b-c-d"), t.makeSlug("A & B!!", "C/D"));
ok("slug length capped", t.makeSlug("x".repeat(80), "y".repeat(80)).length <= 60);
ok("isValidSlug", t.isValidSlug(slug) && !t.isValidSlug("../etc") && !t.isValidSlug("Has-Caps") && !t.isValidSlug("a"));

/* ── public-view ────────────────────────────────────────────────────────── */
const row = {
  slug: "priya-karthik-3f9k",
  template: "sample2",
  wedding_date: "2026-11-14",
  updated_at: "2026-08-02T10:11:12.000Z",
  private_notes: { phone: "9876543210", payment: "UPI 4471" },
  /* Sample 2's shape: a partial override of WEDDING_CONFIG. */
  content: {
    couple: { bride: "Priya", groom: "Karthik", tagline: "Two souls, one sacred fire" },
    wedding: { dateDisplay: "Saturday, 14 November 2026" },
    venue: { name: "Taj Krishna", address: "Banjara Hills, Hyderabad" },
    rsvp: { formUrl: "https://docs.google.com/forms/d/e/abc/viewform", deadline: "By 1 November" },
    theme: { gold: "#C9A24B", maroon: "red; background:url(//evil.example/x)" },
    events: [{ name: "Haldi", time: "10:00", accent: "#D99A2B", evilField: "x" }],
    secretInternalNote: "do not show",
    /* Where 60 MB of template assets live. Not customer data, and letting a
       row override it would point every guest's browser at another host. */
    frames: { loPath: "https://evil.example/frames/" },
  },
  media: [
    { role: "cover", path: "sites/x/aaa.webp", w: 1280, h: 853,
      sizes: { 640: "sites/x/aaa-640.webp", 1280: "sites/x/aaa-1280.webp" } },
    { role: "gallery", path: "sites/x/bbb.webp", w: 1280, h: 853, sizes: {} },
  ],
};
const view = pv.toPublic(row, "https://example.com");
const blob = JSON.stringify(view);

ok("no private_notes", !blob.includes("9876543210") && !blob.includes("UPI 4471"));
ok("no unknown content fields", !blob.includes("secretInternalNote") && !blob.includes("do not show"));
ok("no unknown event fields", !blob.includes("evilField"));
ok("keeps allowed fields", view.content.venue.name === "Taj Krishna" && view.content.events[0].name === "Haldi");
ok("asset paths cannot be overridden", !blob.includes("evil.example/frames"));
ok("a colour that is not a colour is dropped", view.content.theme.maroon === undefined && view.content.theme.gold === "#C9A24B");
ok("an https rsvp form survives", view.content.rsvp.formUrl.startsWith("https://docs.google.com/"));
ok("a non-https rsvp form is dropped",
   pv.toPublic({ ...row, content: { rsvp: { formUrl: "javascript:alert(1)" } } }, "https://example.com").content.rsvp === undefined);
ok("public url built", view.url === "https://example.com/invite/priya-karthik-3f9k");
ok("media resolved to absolute urls", view.media[0].src.startsWith("https://abcd.supabase.co/storage/v1/object/public/wedding-media/"));
ok("srcset built", /640w/.test(view.media[0].srcset) && /1280w/.test(view.media[0].srcset));
ok("media dimensions carried", view.media[0].w === 1280 && view.media[0].h === 853);
ok("media without sizes still resolves", !!view.media[1].src);
ok("updated is a date only", view.updated === "2026-08-02");
ok("coupleLine", pv.coupleLine(view) === "Priya & Karthik", pv.coupleLine(view));
ok("coverImage prefers cover role", pv.coverImage(view).includes("aaa"));
ok("empty media has no cover", pv.coverImage({ media: [] }) === null);

/* Sample 1's shape, which is where the uploaded photographs actually live.
   Markers stay markers: the device decides which width it downloads. */
const s1 = pv.toPublic({
  slug: "asha-vikram-9q2z", template: "sample1",
  updated_at: "2026-08-02T00:00:00Z",
  content: {
    bride: "Asha", groom: "Vikram", phone: "9010901232",
    welcomeImg: "posters/welcome_clean.jpg",
    cover: "@m0",
    photos: ["@m1", null, "@m9", "data:image/png;base64,AAAA", "https://evil.example/x.jpg"],
    events: [{ name: "Haldi", when: "8 Dec, 6 PM", mode: "rub", img: "@m1" }],
    unknownField: "no",
  },
  media: row.media,
}, "https://example.com");

ok("marker kept for the device to resolve", s1.content.cover === "@m0" && s1.content.photos[0] === "@m1");
ok("bundled asset path passes through", s1.content.welcomeImg === "posters/welcome_clean.jpg");
ok("marker beyond the media list is dropped", s1.content.photos[2] === null);
ok("an embedded photograph is refused", s1.content.photos[3] === null);
ok("an off-site image url is refused", s1.content.photos[4] === null);
ok("empty gallery slots keep their position", s1.content.photos.length === 5 && s1.content.photos[1] === null);
ok("sample 1 event fields kept", s1.content.events[0].mode === "rub" && s1.content.events[0].when === "8 Dec, 6 PM");
ok("sample 1 coupleLine", pv.coupleLine(s1) === "Asha & Vikram");
ok("media sizes exposed for the device to choose", view.media[0].sizes[640].includes("aaa-640"));

/* ── render ─────────────────────────────────────────────────────────────── */
const tpl = `<!DOCTYPE html><html><head>
<title>Harshitha &amp; Sai Charan</title>
<meta name="description" content="demo">
<meta property="og:title" content="Harshitha &amp; Sai Charan">
<meta property="og:image" content="https://example.com/demo.jpg">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="styles.css?v=20260730a">
<style>.hero{background:url('assets/hero.webp')}</style>
</head><body>
<a href="#story">Story</a>
<img src="assets/frames/lo/0001.webp" srcset="assets/a-640.webp 640w, assets/a-1280.webp 1280w">
<a href="https://wa.me/919010901232">WhatsApp</a>
<a href="/index.html">Home</a>
<script src="app.js?v=20260730a"></script>
</body></html>`;

const html = r.page(tpl, view, "https://example.com");

ok("demo title removed", !html.includes("Harshitha"));
ok("real title present", html.includes("<title>Priya &amp; Karthik — Wedding Invitation</title>"));
ok("og:image absolute", /<meta property="og:image" content="https:\/\/abcd\.supabase\.co\//.test(html));
ok("og:url correct", html.includes('content="https://example.com/invite/priya-karthik-3f9k"'));
ok("canonical present", html.includes('<link rel="canonical"'));
ok("one og:title only", (html.match(/property="og:title"/g) || []).length === 1);
ok("site json inlined", html.includes("window.DD_SITE=") && html.includes("window.DD_PUBLISHED=true"));
ok("relative css absolutised", html.includes('href="/3D%20Wedding%20Invitation%20Sample%202/styles.css'));
ok("relative script absolutised", html.includes('src="/3D%20Wedding%20Invitation%20Sample%202/app.js'));
ok("relative img absolutised", html.includes('src="/3D%20Wedding%20Invitation%20Sample%202/assets/frames/lo/0001.webp"'));
ok("srcset absolutised", html.includes("/3D%20Wedding%20Invitation%20Sample%202/assets/a-640.webp 640w"));
ok("inline css url absolutised", html.includes("url('/3D%20Wedding%20Invitation%20Sample%202/assets/hero.webp')"));
ok("fragment link untouched", html.includes('href="#story"'));
ok("absolute link untouched", html.includes('href="https://wa.me/919010901232"'));
ok("root-relative link untouched", html.includes('href="/index.html"'));
ok("preconnect to storage", html.includes('rel="preconnect" href="https://abcd.supabase.co"'));
ok("cover preloaded", html.includes('rel="preload" as="image"'));

/* Script-injection through a caption must not be able to close the tag. */
const nasty = pv.toPublic(
  { ...row, content: { ...row.content, venue: { name: "</script><script>alert(1)</script>" } } },
  "https://example.com"
);
const nastyHtml = r.page(tpl, nasty, "https://example.com");
ok("json script cannot be closed", !nastyHtml.includes("</script><script>alert(1)"));
ok("meta attribute escaped", !/content="[^"]*<script/.test(nastyHtml));

ok("404 page standalone", r.notFoundPage("https://example.com").includes("not valid"));
ok("maintenance page standalone", r.maintenancePage("https://example.com").includes("taking a moment"));
ok("error pages leak nothing", !r.notFoundPage("").includes("database") && !r.maintenancePage("").includes("Supabase"));

/* ── auth ───────────────────────────────────────────────────────────────── */
const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; } };
auth.issue(res);
const cookie = res.headers["set-cookie"];
ok("cookie is HttpOnly Secure SameSite", /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Strict/.test(cookie));
const value = cookie.split(";")[0].split("=").slice(1).join("=");
ok("session verifies", !!auth.verify(value));
ok("tampered session rejected", !auth.verify(value.slice(0, -2) + "xx"));
ok("garbage session rejected", !auth.verify("nonsense") && !auth.verify(null));
ok("expired session rejected", (() => {
  const crypto = require("crypto");
  const body = Buffer.from(JSON.stringify({ sub: "admin", exp: 1 })).toString("base64url");
  const sig = Buffer.from(crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(body).digest()).toString("base64url");
  return !auth.verify(`${body}.${sig}`);
})());
ok("password check", auth.checkPassword("correct horse battery staple") && !auth.checkPassword("wrong"));
ok("password check rejects non-strings", !auth.checkPassword(undefined) && !auth.checkPassword({}));

/* ── http redaction ─────────────────────────────────────────────────────── */
const red = http.redact({
  token: "DD-AAAAA-BBBBB-CCCCC",
  nested: { password: "hunter2", idempotencyKey: "abc", fine: "keep" },
  list: [{ secret: "s" }],
});
const redBlob = JSON.stringify(red);
ok("redacts token", !redBlob.includes("DD-AAAAA"));
ok("redacts nested password", !redBlob.includes("hunter2"));
ok("redacts inside arrays", !redBlob.includes('"secret":"s"'));
ok("keeps harmless fields", redBlob.includes("keep"));
ok("safeEqual", http.safeEqual("abc", "abc") && !http.safeEqual("abc", "abd") && !http.safeEqual("abc", "ab"));


/* ── limits (server enforcement) ────────────────────────────────────────── */
const L = require('./limits');
const throws = (fn, code) => { try { fn(); return false; } catch (e) { return code ? e.code === code : true; } };
const sha = 'a'.repeat(64);
const file = (o) => ({ sha256: sha, bytes: 1000, type: 'image/webp', w: 640, h: 400, ...o });

ok('content accepted', L.checkContent({ brideName: 'Priya' }) > 0);
ok('content must be object', throws(() => L.checkContent('x'), 'BAD_REQUEST'));
ok('content size capped', throws(() => L.checkContent({ x: 'y'.repeat(200000) }), 'TOO_LARGE'));
ok('embedded base64 refused', throws(() => L.checkContent({ x: 'data:image/png;base64,AAAA' }), 'BAD_REQUEST'));
ok('template checked', L.checkTemplate('sample1') === 'sample1' && throws(() => L.checkTemplate('sample3')));
ok('files accepted', L.checkFileDescriptors([file()]).length === 1);
ok('bad hash refused', throws(() => L.checkFileDescriptors([file({ sha256: 'zz' })])));
ok('oversized photo refused', throws(() => L.checkFileDescriptors([file({ bytes: 999999 })]), 'TOO_LARGE'));
ok('too many descriptors refused', throws(() => L.checkFileDescriptors(Array.from({length:25},(_,i)=>file({sha256:String(i).padStart(64,'b')}))), 'TOO_LARGE'));
ok('total media capped', throws(() => L.checkFileDescriptors(Array.from({length:24},(_,i)=>file({sha256:String(i).padStart(64,'c'),bytes:250*1024}))), 'TOO_LARGE'));
ok('bad type refused', throws(() => L.checkFileDescriptors([file({ type: 'image/gif' })])));
ok('bad variant refused', throws(() => L.checkFileDescriptors([file({ variant: 999 })])));
ok('duplicate hash collapsed', L.checkFileDescriptors([file(), file()]).length === 1);
ok('media inside draft accepted', L.checkMediaRefs([{ path: 'drafts/abc/1.webp', sizes: { 640: 'drafts/abc/1-640.webp' } }], 'drafts/abc/').length === 1);
ok('media outside draft refused', throws(() => L.checkMediaRefs([{ path: 'drafts/other/1.webp' }], 'drafts/abc/')));
ok('media traversal refused', throws(() => L.checkMediaRefs([{ path: 'drafts/abc/../other/1.webp' }], 'drafts/abc/')));
ok('media size variant outside draft refused', throws(() => L.checkMediaRefs([{ path: 'drafts/abc/1.webp', sizes: { 640: 'drafts/evil/1.webp' } }], 'drafts/abc/')));
ok('idempotency key checked', L.checkIdempotencyKey('a'.repeat(24)) && throws(() => L.checkIdempotencyKey('short')));
ok('date parsed', L.checkDate('2026-11-14') === '2026-11-14' && L.checkDate('') === null && L.checkDate('rubbish') === null);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed");
process.exit(fails ? 1 : 0);
