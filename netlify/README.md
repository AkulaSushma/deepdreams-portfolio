# Deploying on Netlify

## Why Netlify and not Vercel

Vercel's free Hobby plan says: *"Hobby teams are restricted to non-commercial personal
use only. All commercial usage requires either a Pro or Enterprise plan."* The moment a
customer pays for a wedding website, this site is commercial.

Netlify's staff answer the same question directly on their own forum: *"Yes, you can use
the free plan for commercial projects."* The only prohibition is reselling Netlify
hosting itself. Charging customers for your own work is fine.

So the move is not about features. It is about being allowed to take money.

## What actually changed

Almost nothing, and that was the point of choosing Netlify over Cloudflare.

Netlify runs Node.js, the same as Vercel. So every file under `api/` — the token
hashing, the one-code-one-website lock, the admin session signing, the storage adapter —
moved across **untouched**. Rewriting any of that during a hosting move is how a
security hole gets introduced.

| Added | What it does |
| --- | --- |
| `netlify/lib/bridge.js` | The only file that knows this is Netlify. Translates Netlify's request object into the `(req, res)` pair the handlers already expect. ~120 lines. |
| `netlify/functions/*.js` | One thin wrapper per endpoint. Each is three lines. |
| `netlify/build.js` | Assembles `dist/` — the website without the server code. Netlify's `.vercelignore`. |
| `netlify.toml` | Routes, headers and the daily schedule. |
| `404.html` | Netlify serves this for anything unmatched. Written for a relative who lost a character off an invitation link. |
| `netlify/set-origin.js` | Rewrites the few tags that cannot be relative. One command per address change. |

`vercel.json` is deliberately kept. Until the first customer link exists, both platforms
can serve this repository, and having a way back costs nothing.

## First deploy

1. **Set the environment variables.** All seven, from [`../supabase/README.md`](../supabase/README.md).
   Nothing works without them, and the failures are deliberately quiet — a missing
   `CRON_SECRET` makes the daily job refuse to run rather than run unguarded.

2. **Point the site at its new address.** Once you know your Netlify site name:

   ```bash
   node netlify/set-origin.js https://your-site.netlify.app --write
   ```

   That rewrites the thirteen tags that cannot be relative — `og:image`, `og:url`,
   `canonical`, `twitter:image`, the `Sitemap:` line and the four `sitemap.xml` entries.
   Run it with no arguments first to see exactly what it would change.

   Everything else on the site already uses relative paths, so this is the whole of it.
   Use the same value for `PUBLIC_ORIGIN`; the two must agree.

3. **Deploy.**

   ```bash
   npx netlify-cli deploy --prod
   ```

   Netlify reads `netlify.toml`, runs `node netlify/build.js`, and publishes `dist/`.

4. **Check the four things that matter**, replacing the host with yours:

   ```bash
   curl -sI https://your-site.netlify.app/ | head -1
   curl -sI https://your-site.netlify.app/invite/nothing-here | head -1
   curl -sI https://your-site.netlify.app/api/admin/tokens | head -1
   curl -sI https://your-site.netlify.app/api/nonsense | head -1
   ```

   Expected: `200`, `404`, `401`, `404`. A `200` on the third line means the admin
   endpoints are open — stop and check `ADMIN_SESSION_SECRET`.

5. **Confirm the server code is not downloadable:**

   ```bash
   curl -sI https://your-site.netlify.app/api/_lib/tokens.js | head -1
   ```

   Must be `404`. It holds no secrets, but it should not be there.

6. **Run the daily job once by hand** so you see it work before it runs at night:

   ```bash
   curl "https://your-site.netlify.app/api/cron/keepalive?key=$CRON_SECRET"
   ```

## Before connecting Git

Netlify can rebuild on every push, which is better than deploying from your laptop. One
thing must be fixed first.

`3D Wedding Invitation Sample 2` is recorded in this repository as a **gitlink** — a
pointer to a commit — with no `.gitmodules` entry naming where to fetch it from. A fresh
clone therefore produces an **empty folder**. It has never mattered because deploys have
always been uploaded from a machine where the folder exists.

A Git-connected Netlify build starts from a fresh clone. Connect Git before fixing this
and the deploy will succeed while quietly serving a wedding template with no files in
it.

Fix it first, then connect Git. Until then, `netlify deploy --prod` from your own
machine is correct and safe.

## Later, when you buy a domain

Two commands and one variable:

```bash
node netlify/set-origin.js https://deepdreamsaistudio.in --write
```

Then change `PUBLIC_ORIGIN` in Netlify to match, add the domain in Netlify's
Domain management, and redeploy. Netlify issues the HTTPS certificate itself.

Do this **before** you have many customers. Invitation links already in a family's
WhatsApp group are built from `PUBLIC_ORIGIN` as it was on the day of publishing, and
`netlify.app` is Netlify's hostname, not yours. Moving hosts later would strand every
one of those links. Your own domain makes them permanently yours.

## The limits to watch

| Free allowance | What happens at the edge of it |
| --- | --- |
| 100 GB bandwidth/month | Photographs load from Supabase, not from here, so this is mostly HTML. |
| 125,000 function calls/month | About 4,000 a day. Invitation pages are CDN-cached, so most guests never invoke a function at all. |
| 300 build minutes/month | This build is a file copy. Seconds. |

**Exceeding a limit suspends the site for the rest of the calendar month.** That is the
one genuinely dangerous property of this plan: it fails on a wedding morning, not on a
Tuesday. Netlify emails before it happens. Watch the number monthly.

## Sources

- [Vercel Hobby — non-commercial restriction](https://vercel.com/docs/limits/fair-use-guidelines)
- [Netlify staff: commercial use is allowed on Free](https://answers.netlify.com/t/can-we-use-netlify-free-plan-for-commercial-purposes/41545/2)
- [Netlify pricing and limits](https://www.netlify.com/pricing/)
- [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
