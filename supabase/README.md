# Supabase setup

One-time setup for the token-gated publishing backend. Nothing here costs money and
nothing here asks for a card.

## 1. Create the project

1. supabase.com → New project → **Free** plan.
2. Region: **South Asia (Mumbai) `ap-south-1`** — customers and guests are in India, and
   this is the single largest lever on how fast a published invitation opens.
3. Save the database password somewhere safe. You will not need it for this application
   (all access is over HTTPS), but you cannot see it again.

## 2. Apply the schema

SQL Editor → New query → paste all of `schema.sql` → Run. It is idempotent; running it
twice is harmless.

Verify afterwards, in the same editor:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

All four tables must show `rowsecurity = true`. If any shows `false`, stop — the anon key
would be able to read customer data.

## 3. Create the storage buckets

Storage → New bucket, twice:

| Bucket | Public? | Holds |
| --- | --- | --- |
| `wedding-media` | **Public** | Customer photographs. Public because guests must load them without a key, and because routing every image through a Vercel Function is exactly what we are avoiding. |
| `wedding-backups` | **Private** | The daily JSON export written by the cron job. |

`wedding-media` being public is safe: paths are content-hashed (`sites/<uuid>/<sha256>.webp`),
so they are unguessable, and nothing private is ever stored there. It holds only photographs
the couple is about to send to two hundred relatives anyway.

## 4. Environment variables in Netlify

Site configuration → Environment variables. Add each one to **all deploy contexts**
(production, deploy previews and branch deploys) unless noted.

| Name | Where to find it | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Project Settings → API → Project URL | |
| `SUPABASE_SERVICE_KEY` | Project Settings → API → `service_role` **secret** | **Never** put this in any file under a template folder, and never in a name a bundler would expose to the browser. It bypasses every security rule in the database. |
| `TOKEN_PEPPER` | Generate: `openssl rand -hex 32` | Mixed into every token hash. Changing it later invalidates every unconsumed token. |
| `ADMIN_PASSWORD` | Choose a long passphrase | Verified server-side only. Never appears in any file the browser downloads. |
| `ADMIN_SESSION_SECRET` | Generate: `openssl rand -hex 32` | Signs the admin session cookie. |
| `CRON_SECRET` | Generate: `openssl rand -hex 16` | Guards the manual run of the daily job. |
| `PUBLIC_ORIGIN` | Your site's address, e.g. `https://deepdreams.netlify.app` | Used to build every customer link and `og:image` URL. **Production only** — leave it unset for previews, so a test publish cannot mint a link on the live domain. |

Generate all three secrets at once:

```bash
printf 'TOKEN_PEPPER=%s\nADMIN_SESSION_SECRET=%s\nCRON_SECRET=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 16)"
```

### About `PUBLIC_ORIGIN`

This is the single most consequential value here. Every link a customer forwards to
their relatives is built from it, and once those links are out, changing it strands
every one of them.

Set it to a domain **you own** before you have many customers. `deepdreams.netlify.app`
belongs to Netlify: it works perfectly, but if you ever move hosts again, every link
already in a family's WhatsApp group stops opening. Your own domain — about ₹900 a
year — makes the links permanently yours and the host an implementation detail.

Changing it later is one variable and a redeploy. Retrieving fifty invitation links
from fifty families' phones is not.

## 5. The studio console

`/admin/index.html`, signed in with `ADMIN_PASSWORD`. This is where you mint an activation
code after a customer has paid, and where you take a website offline or restore a version
if one asks.

The page itself is public — anyone who guesses the path can download it — and holds
nothing: no password, no key, no list of codes. Everything real comes from
`/api/admin/*`, and each of those refuses a request without a valid session cookie.

An activation code is shown **once**, in the reply to the request that created it. The
database stores only `sha256(code + TOKEN_PEPPER)`, so a code cannot be looked up again
later, by you or by anyone else. If you lose one before sending it, revoke it and mint
another.

## 6. The daily job

Runs once a day at 02:17 UTC — 07:47 in India — and does four things:

1. **Touches the database**, so Supabase Free does not pause the project after a week of
   quiet. A paused project means every published invitation stops loading — most likely
   during somebody's wedding week.
2. **Sweeps abandoned uploads.** Photographs are uploaded before the code is spent,
   because a customer must see the finished invitation before paying. Anything belonging
   to a code still unspent after `DRAFT_TTL_DAYS` (7) is deleted. The folder is derived
   from the code's hash rather than stored, so the sweep starts from the codes.
3. **Trims version history** to the last 10 per website.
4. **Backs up** every website as JSON into `wedding-backups`, keeping a fortnight. Free
   has no point-in-time recovery, so this is the only copy outside the live table.

To run it by hand: `curl "https://<your-domain>/api/cron/keepalive?key=$CRON_SECRET"`.
Without the secret it answers 404 — a scanner learns nothing.

The scheduled run and the manual run are two separate functions on purpose. Netlify
will not let a URL reach a scheduled function, so that one supplies its own secret;
the manual route is public, so it supplies nothing and the secret is the only way in.

Netlify caps a scheduled function at **30 seconds**. The sweep is the only job whose
work grows over time, so it stops after 15 seconds and reports how many folders it
did not reach; the next night continues from there. A `unfinished` count that stays
high for a week means the sweep is falling behind — not that anything is broken.

## 7. No dependencies

The API talks to Supabase over plain HTTPS using Node's built-in `fetch` — PostgREST for
the database, the Storage REST API for files. There is no `@supabase/supabase-js`, no
`package.json`, and no `node_modules` in this repository.

That is a deliberate choice, not a shortcut. It keeps the site exactly as deployable as it
is today, keeps function cold starts short, and means the storage adapter in
`api/_lib/storage.js` is genuinely swappable — moving to Cloudflare R2 or S3 later means
rewriting one file, not removing an SDK that has spread through the codebase.

## What happens when a free-tier limit is reached

| Limit | Free allowance | What you will see |
| --- | --- | --- |
| Database | 500 MB | Writes begin failing. Publishing breaks; already-published invitations keep loading from the CDN cache. |
| Storage | 1 GB | Photograph uploads fail during publishing. Existing photographs keep serving. |
| Egress | 5 GB/month | Image requests start failing. **This is the first ceiling you will hit.** |
| Idle | 1 week | The project pauses. The daily cron job exists to prevent this. |

Supabase emails you at 80 % of any limit. There is no published pay-as-you-go rate on the
Free plan, so these behave as hard stops rather than as a surprise bill — safer for your
bank account, more dangerous on a wedding morning. Watch the numbers weekly in
Reports → Usage.
