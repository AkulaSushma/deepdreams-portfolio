/* ============================================================================
   TOKENS & IDENTIFIERS — activation codes, draft folders, public slugs.

   One idea holds the three together: every identifier in this system is either
   a secret nobody can guess, or a public string that reveals nothing. Nothing
   in between.

     activation code  DD-K7M2Q-9XRTB-4WHZN   secret, 75 bits, hashed at rest
     draft folder     drafts/a91f4c…/        derived from the code, never sent
     public slug      priya-karthik-3f9k     public, carries no id or secret
   ========================================================================= */
"use strict";

const crypto = require("crypto");
const LIMITS = require("../../shared/limits.js");

/* Crockford base32: no I, L, O or U. A customer reads this code off WhatsApp
   and types it on a phone keyboard, so the alphabet must not contain two
   characters that look the same in a sans-serif font, and must not be able to
   spell anything unfortunate. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const GROUPS = LIMITS.TOKEN_GROUPS;        // 3
const GROUP_SIZE = LIMITS.TOKEN_GROUP_SIZE; // 5  → 15 chars → 75 bits

/** Generate a fresh activation code. Called by the admin API only; the plain
 *  text is shown to you exactly once, at that moment, and is never stored. */
function generate() {
  const bytes = crypto.randomBytes(GROUPS * GROUP_SIZE);
  let out = "DD";
  for (let g = 0; g < GROUPS; g++) {
    out += "-";
    for (let i = 0; i < GROUP_SIZE; i++) {
      out += ALPHABET[bytes[g * GROUP_SIZE + i] % 32];
    }
  }
  return out;
}

/** Fold the ways a human retypes a code back into one canonical form:
 *  lowercase, stray spaces, a missing prefix, and the classic confusions
 *  (I or l for 1, O for 0). A customer should never be told their code is
 *  wrong because they typed a lowercase o. */
function normalise(raw) {
  if (typeof raw !== "string") return "";

  let s = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");

  if (s.startsWith("DD")) s = s.slice(2);
  if (s.length !== GROUPS * GROUP_SIZE) return "";
  if (!/^[0-9A-HJKMNP-TV-Z]+$/.test(s)) return "";

  const parts = [];
  for (let i = 0; i < GROUPS; i++) parts.push(s.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE));
  return `DD-${parts.join("-")}`;
}

/** A shape check, nothing more. It exists so an obvious typo gets an instant
 *  answer instead of a round trip — never as a security control. Whether a
 *  code is real is decided only by the database. */
function looksValid(raw) {
  return normalise(raw) !== "";
}

/** sha256(code + pepper), hex. The pepper lives in a Vercel environment
 *  variable, so a stolen database dump is not enough to publish anything:
 *  an attacker would need the pepper too, and even then would have to reverse
 *  a 75-bit search space per token. */
function hash(raw) {
  const code = normalise(raw);
  if (!code) return "";
  const pepper = process.env.TOKEN_PEPPER;
  if (!pepper) {
    const e = new Error("TOKEN_PEPPER is not set");
    e.code = "UPSTREAM";
    throw e;
  }
  return crypto.createHash("sha256").update(code + pepper, "utf8").digest("hex");
}

/** Where this customer's uploads live before publishing. Derived from the
 *  token hash rather than stored, which buys three things at once: the folder
 *  is stable across retries so an interrupted publish does not re-upload
 *  photographs; it is scoped to one paying customer, so nobody can address
 *  anyone else's files; and it needs no extra table.
 *
 *  Hashed a second time with a different label so that even someone who
 *  somehow saw a draft path could not walk back to the token hash. */
function draftId(tokenHash) {
  return crypto
    .createHash("sha256")
    .update(`${tokenHash}:draft`, "utf8")
    .digest("hex")
    .slice(0, 24);
}

/* ── Public slugs ───────────────────────────────────────────────────────── */

/* Four characters from an unambiguous alphabet. Not a secret — its job is to
   stop two "Priya & Karthik" weddings from colliding, not to hide anything. */
const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomSuffix(n = 4) {
  const bytes = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  return out;
}

/** "Priya" + "Karthik" → "priya-karthik-3f9k".
 *
 *  Deliberately built from names the couple is about to publish anyway. It
 *  contains no database id, no token, no editing secret and no phone number,
 *  so the link is safe to forward to two hundred relatives — which is the
 *  entire point of it. Non-Latin names fall back to a neutral word rather
 *  than producing an empty or mangled slug. */
function makeSlug(nameA, nameB) {
  /* Combining accent marks, left behind by NFKD. Built from char codes:
     typed literally they are invisible and easy to mangle. */
  const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

  const clean = (s) =>
    String(s || "")
      .normalize("NFKD")
      .replace(COMBINING, "")     // strip accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);

  const parts = [clean(nameA), clean(nameB)].filter(Boolean);
  const base = parts.length ? parts.join("-") : "wedding";
  return `${base}-${randomSuffix()}`.slice(0, LIMITS.MAX_SLUG_LENGTH);
}

/** What a URL may contain before we will look it up. Anything else is a 404
 *  without touching the database. */
function isValidSlug(slug) {
  return (
    typeof slug === "string" &&
    slug.length >= 3 &&
    slug.length <= LIMITS.MAX_SLUG_LENGTH &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  );
}

module.exports = {
  generate, normalise, looksValid, hash, draftId,
  makeSlug, isValidSlug, randomSuffix,
};
