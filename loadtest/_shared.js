/* Shared setup for the k6 scripts. Kept deliberately small — a load test that
   needs debugging is a load test you stop trusting. */

export const BASE = (__ENV.BASE_URL || "").replace(/\/+$/, "");

if (!BASE) {
  throw new Error("Set BASE_URL. Never point these at production.");
}

/* Every hostname that has ever served a real customer link. Add to this before
   pointing a domain at the site, not after. */
const PRODUCTION = /^https:\/\/(deepdreams-portfolio(-lac)?\.vercel\.app|[a-z0-9-]*deepdreams[a-z0-9-]*\.netlify\.app)/;

if (PRODUCTION.test(BASE) && !__ENV.I_MEAN_IT) {
  /* These scripts spend activation codes and create real websites. Running one
     against the live site would burn paid codes and fill the free tier with
     rubbish. Overridable, because one day you may genuinely want a read-only
     view test against production. */
  throw new Error("That looks like production. Use a staging deployment, or set I_MEAN_IT=1.");
}

export const slugs = (__ENV.SLUGS || "").split(",").map((s) => s.trim()).filter(Boolean);
export const codes = (__ENV.CODES || "").split(",").map((s) => s.trim()).filter(Boolean);

/** A minimal but realistic invitation: the fields a couple actually fills in,
 *  sized like the real thing rather than like a smoke test. */
export function content(n) {
  return {
    couple: {
      bride: `Bride${n}`,
      groom: `Groom${n}`,
      brideFull: `Bride${n} Testcase`,
      groomFull: `Groom${n} Testcase`,
      monogram: "B · G",
      tagline: "Two souls, one sacred fire",
    },
    wedding: {
      dateISO: "2027-03-14T18:30:00+05:30",
      dateDisplay: "Sunday, 14 March 2027",
      muhurat: "Shubh Muhurat · 6:30 PM",
    },
    venue: {
      name: "Load Test Gardens",
      address: "Some Road, Hyderabad, Telangana 500001",
      mapsQuery: "Load Test Gardens Hyderabad",
    },
  };
}

export const jsonHeaders = { "Content-Type": "application/json" };
