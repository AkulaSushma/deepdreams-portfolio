-- ============================================================================
-- DeepDreams AI Studio — token-gated wedding publishing
-- Supabase Postgres schema.  Apply once, in the Supabase SQL editor.
--
-- Design rules this file enforces, so nothing above it has to remember them:
--
--   1. A token is never stored.  Only sha256(token || pepper) is, so a leaked
--      database dump cannot be used to publish anything.
--   2. One token activates exactly one wedding website.  Two constraints say
--      so independently: activation_tokens.site_id is UNIQUE, and the publish
--      RPC only claims a token whose status is still 'issued'.
--   3. Consuming a token and creating the website happen in ONE transaction.
--      A customer can never lose a paid token without a website to show for it.
--   4. RLS is on with no policies at all.  The anon key — the only key a
--      browser could ever obtain — reads nothing.  Every legitimate read goes
--      through a Vercel Function holding the service-role key.
-- ============================================================================

-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;      -- gen_random_uuid()


-- ─── Wedding sites ─────────────────────────────────────────────────────────
-- One row per published invitation.  `content` holds text only; photographs
-- live in object storage and appear here purely as paths inside `media`.
-- Putting image bytes in this table would blow the 500 MB free-tier database
-- and make every public read enormous.
create table if not exists wedding_sites (
  id             uuid primary key default gen_random_uuid(),

  -- The public link.  Deliberately carries no id, no token, no secret:
  -- "priya-karthik-3f9k".
  slug           text not null unique,

  template       text not null check (template in ('sample1','sample2')),

  -- Names, dates, venue, colours.  Capped so one malformed draft cannot
  -- consume a measurable share of a 500 MB database.
  content        jsonb not null,

  -- [{ "role":"gallery", "idx":0, "path":"sites/<id>/<sha>.webp",
  --    "w":1280, "h":853, "sizes":{"640":"…","1280":"…"} }]
  media          jsonb not null default '[]'::jsonb,

  status         text not null default 'live' check (status in ('live','disabled')),
  wedding_date   date,

  published_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Phone number, payment reference, studio notes.  NEVER served publicly:
  -- api/_lib/public-view.js builds responses from an allow-list, so this
  -- column cannot leak by being forgotten.
  private_notes  jsonb not null default '{}'::jsonb,

  constraint content_size_sane check (pg_column_size(content) < 150000),
  constraint media_size_sane   check (pg_column_size(media)   < 60000)
);

-- The only index a guest's page view depends on.
create unique index if not exists wedding_sites_slug_idx on wedding_sites (slug);
create index if not exists wedding_sites_status_idx      on wedding_sites (status);


-- ─── Activation tokens ─────────────────────────────────────────────────────
create table if not exists activation_tokens (
  id           uuid primary key default gen_random_uuid(),

  -- sha256(token || pepper), hex.  The plain token exists only on the piece
  -- of paper (or WhatsApp message) you hand the customer.
  token_hash   text not null unique,

  -- Your own reference: "Priya & Karthik · paid 2 Aug · UPI 4471".
  label        text,

  template     text not null check (template in ('sample1','sample2')),
  status       text not null default 'issued'
                 check (status in ('issued','consumed','revoked')),

  issued_at    timestamptz not null default now(),
  consumed_at  timestamptz,

  -- UNIQUE is the second, independent guarantee that one token cannot be
  -- spread across two weddings.
  site_id      uuid unique references wedding_sites(id) on delete set null,

  notes        text
);

create unique index if not exists activation_tokens_hash_idx   on activation_tokens (token_hash);
create index        if not exists activation_tokens_status_idx on activation_tokens (status);
create index        if not exists activation_tokens_site_idx   on activation_tokens (site_id);


-- ─── Content versions ──────────────────────────────────────────────────────
-- Every publish and every studio edit writes one row BEFORE touching the live
-- site, so a bad edit is always one click from being undone.  Supabase Free
-- has no point-in-time recovery; this table is the substitute for the data
-- that actually matters.
create table if not exists site_versions (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references wedding_sites(id) on delete cascade,
  content    jsonb not null,
  media      jsonb not null default '[]'::jsonb,
  reason     text,                                   -- 'publish' | 'edit' | 'rollback'
  created_at timestamptz not null default now()
);

create index if not exists site_versions_site_idx on site_versions (site_id, created_at desc);


-- ─── Publish idempotency ───────────────────────────────────────────────────
-- The customer's browser generates one key before its first publish attempt
-- and reuses it for every retry.  A double tap, a flaky connection or an
-- impatient reload therefore cannot create two websites or spend two tokens.
create table if not exists publish_attempts (
  idempotency_key text primary key,
  site_id         uuid references wedding_sites(id) on delete cascade,
  created_at      timestamptz not null default now()
);


-- ─── Lock everything down ──────────────────────────────────────────────────
-- Enabled with zero policies: the anon and authenticated roles can read and
-- write nothing.  Only the service-role key, which lives in a Vercel
-- environment variable and never reaches a browser, bypasses RLS.
alter table wedding_sites     enable row level security;
alter table activation_tokens enable row level security;
alter table site_versions     enable row level security;
alter table publish_attempts  enable row level security;

revoke all on wedding_sites, activation_tokens, site_versions, publish_attempts
  from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- publish_site — the one operation that must never go half-done
-- ═══════════════════════════════════════════════════════════════════════════
-- Returns the slug and id of the site this token published.  Raises:
--   TOKEN_NOT_AVAILABLE  — unknown, already consumed, revoked, or wrong template
--   SLUG_TAKEN           — caller must retry with a fresh suffix
--
-- Concurrency: the UPDATE's WHERE clause is the lock.  Two simultaneous
-- callers with the same token both attempt `status = 'issued' -> 'consumed'`;
-- Postgres serialises them and the loser matches zero rows and raises.  No
-- advisory lock, no SELECT ... FOR UPDATE, no race window.
create or replace function publish_site(
  p_token_hash text,
  p_idem       text,
  p_template   text,
  p_slug       text,
  p_content    jsonb,
  p_media      jsonb,
  p_wedding_date date default null
)
returns table (out_slug text, out_site_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site uuid;
  v_tok  uuid;
begin
  -- A replay of an attempt that already succeeded.  Hand back the same
  -- answer instead of publishing again.  This is also what powers "recover
  -- my link" after an interrupted response.
  select pa.site_id into v_site
    from publish_attempts pa
   where pa.idempotency_key = p_idem;

  if found and v_site is not null then
    return query select w.slug, w.id from wedding_sites w where w.id = v_site;
    return;
  end if;

  -- Claim the token.
  update activation_tokens t
     set status = 'consumed', consumed_at = now()
   where t.token_hash = p_token_hash
     and t.status     = 'issued'
     and t.template   = p_template
  returning t.id into v_tok;

  if v_tok is null then
    raise exception 'TOKEN_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  begin
    insert into wedding_sites (slug, template, content, media, wedding_date)
         values (p_slug, p_template, p_content, p_media, p_wedding_date)
      returning id into v_site;
  exception when unique_violation then
    -- Rolls the token claim back with it: nothing is spent.
    raise exception 'SLUG_TAKEN' using errcode = 'P0001';
  end;

  update activation_tokens set site_id = v_site where id = v_tok;

  insert into publish_attempts (idempotency_key, site_id)
       values (p_idem, v_site);

  insert into site_versions (site_id, content, media, reason)
       values (v_site, p_content, p_media, 'publish');

  return query select p_slug, v_site;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- find_site_by_token — "I already paid, where is my link?"
-- ═══════════════════════════════════════════════════════════════════════════
-- Covers the case where publishing succeeded but the response never arrived.
-- Returns nothing rather than raising, so the API can answer honestly.
create or replace function find_site_by_token(p_token_hash text)
returns table (out_slug text, out_site_id uuid)
language sql
security definer
set search_path = public
as $$
  select w.slug, w.id
    from activation_tokens t
    join wedding_sites w on w.id = t.site_id
   where t.token_hash = p_token_hash
     and t.status     = 'consumed';
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- update_site — studio-side edit, snapshot first
-- ═══════════════════════════════════════════════════════════════════════════
-- The version row is written BEFORE the live row changes, inside the same
-- transaction.  If the update fails, the live invitation is untouched and the
-- snapshot rolls back with it — a failed edit cannot damage a wedding that is
-- already in guests' hands.  The slug is never rewritten: links already sent
-- on WhatsApp keep working.
create or replace function update_site(
  p_site_id      uuid,
  p_content      jsonb,
  p_media        jsonb,
  p_wedding_date date default null
)
returns table (out_slug text, out_version_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver  uuid;
  v_slug text;
begin
  insert into site_versions (site_id, content, media, reason)
       select w.id, w.content, w.media, 'edit'
         from wedding_sites w
        where w.id = p_site_id
    returning id into v_ver;

  if v_ver is null then
    raise exception 'SITE_NOT_FOUND' using errcode = 'P0001';
  end if;

  update wedding_sites
     set content      = p_content,
         media        = p_media,
         wedding_date = coalesce(p_wedding_date, wedding_date),
         updated_at   = now()
   where id = p_site_id
  returning slug into v_slug;

  return query select v_slug, v_ver;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- rollback_site — restore a previous version
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function rollback_site(p_site_id uuid, p_version_id uuid)
returns table (out_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content jsonb;
  v_media   jsonb;
  v_slug    text;
begin
  select sv.content, sv.media into v_content, v_media
    from site_versions sv
   where sv.id = p_version_id and sv.site_id = p_site_id;

  if v_content is null then
    raise exception 'VERSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Snapshot what we are replacing, so a rollback is itself reversible.
  insert into site_versions (site_id, content, media, reason)
       select w.id, w.content, w.media, 'rollback'
         from wedding_sites w where w.id = p_site_id;

  update wedding_sites
     set content = v_content, media = v_media, updated_at = now()
   where id = p_site_id
  returning slug into v_slug;

  return query select v_slug;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- prune_site_versions — keep the table from growing without bound
-- ═══════════════════════════════════════════════════════════════════════════
-- Called by the daily cron.  Keeps the newest N versions per site; the free
-- tier's 500 MB is generous but not infinite.
create or replace function prune_site_versions(p_keep int default 10)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted int;
begin
  with ranked as (
    select id, row_number() over (partition by site_id order by created_at desc) as rn
      from site_versions
  )
  delete from site_versions sv
   using ranked r
   where sv.id = r.id and r.rn > p_keep;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


-- ─── Function permissions ──────────────────────────────────────────────────
-- security definer functions are callable by anyone who can reach PostgREST
-- unless we say otherwise.  Only the service-role key may call them.
revoke all on function publish_site(text, text, text, text, jsonb, jsonb, date) from public, anon, authenticated;
revoke all on function find_site_by_token(text)                                 from public, anon, authenticated;
revoke all on function update_site(uuid, jsonb, jsonb, date)                    from public, anon, authenticated;
revoke all on function rollback_site(uuid, uuid)                                from public, anon, authenticated;
revoke all on function prune_site_versions(int)                                 from public, anon, authenticated;
