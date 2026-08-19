# Load tests

Five k6 scripts that check the five claims the plan makes about behaviour under load.
They are the only way to find out whether the free tier holds before a real customer
does it for us.

## Before you run anything

**Never point these at production.** They spend activation codes, create websites and
write to storage. Use a separate Supabase project and a Vercel preview deployment with
its own environment variables.

```bash
export BASE_URL="https://deepdreams-portfolio-git-staging.vercel.app"
```

Install k6 (free, open source, no account): <https://k6.io/docs/get-started/installation/>

## The five

| Script | What it answers | Pass condition |
| --- | --- | --- |
| `view-one.js` | 100 guests open the same invitation at once — the WhatsApp-forward case | p95 < 800 ms, 0 errors, and the CDN serving most of it |
| `view-many.js` | 100 guests across 100 different invitations — the worst case for the database | p95 < 1500 ms, 0 errors |
| `publish.js` | 10 customers publish at the same moment | every one gets a link, no two the same |
| `upload.js` | 10 photograph uploads at once | all succeed, and no upload passes through a Vercel Function |
| `one-token.js` | 20 simultaneous attempts with **one** code | exactly 1 success, 19 clean refusals |

`one-token.js` is the commercially important one. `flow.test.js` already proves it against
an in-memory fake; this proves it against real Postgres, where the lock actually has to
work.

## Running them

```bash
k6 run -e BASE_URL="$BASE_URL" loadtest/view-one.js
```

`view-one.js` and `view-many.js` need slugs to read. Publish a few on staging first and
put them in a file:

```bash
k6 run -e BASE_URL="$BASE_URL" -e SLUGS="priya-karthik-af7b,meera-arjun-9k2" loadtest/view-one.js
```

`publish.js`, `upload.js` and `one-token.js` need codes minted on staging:

```bash
k6 run -e BASE_URL="$BASE_URL" -e CODES="DD-AAAAA-BBBBB-CCCCC,DD-DDDDD-EEEEE-FFFFF" loadtest/publish.js
k6 run -e BASE_URL="$BASE_URL" -e CODE="DD-AAAAA-BBBBB-CCCCC" loadtest/one-token.js
k6 run -e BASE_URL="$BASE_URL" -e CODE="DD-AAAAA-BBBBB-CCCCC" loadtest/upload.js
```

### What each run costs you

| Script | Spends codes? | Leaves behind |
| --- | --- | --- |
| `view-one`, `view-many` | no | nothing |
| `publish` | **one per VU** | up to 10 published websites |
| `one-token` | **one** | one published website |
| `upload` | no — preflight consumes nothing | 2 MB of files, cleared by the nightly sweep |

`publish.js` and `one-token.js` need codes minted on staging beforehand, and those
codes are gone afterwards. Mint them in a batch from the studio console.

### One caveat on `one-token.js`

Twenty requests leave one machine, so they arrive from one IP, and the in-memory
rate limiter (10 publishes per IP per warm instance) turns some away before the
database ever sees them. A refusal is still a refusal, so the test passes — but it
proves less than it looks. The summary says so when more than twelve of the
nineteen were rate-limited; when that happens, run it from two or three machines,
or raise the publish limit on staging only.

## Reading the result

The number that matters on the viewing tests is not latency, it is **how much of the
traffic the database saw**. Every response carries `x-vercel-cache`; a run where most
requests are `HIT` is a run where 100 guests cost one query. If they are mostly `MISS`,
the caching is not doing its job and the free tier will not survive a real wedding.

Watch Supabase → Reports → Usage after each run. Egress is the first ceiling.
