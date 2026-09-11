// Hybrid Worker: serves the static site as-is, and proxies /api/reps so the
// 5 Calls API token never reaches the browser. The token is read from
// env.FIVECALLS_TOKEN, which must be set as a Cloudflare secret — never
// committed to the repo, never present in any file the browser can fetch.
//
// Note: dashboard-set secrets don't always apply to an already-running preview
// deployment for Git-connected Workers Builds projects — this comment exists
// to force a fresh build/deploy so a newly-added secret actually gets picked up.

const FIVECALLS_BASE = "https://api.5calls.org/v1/representatives";

// 5 Calls covers federal AND state officials; we only want the two federal
// chambers for this site. Filtering on `area` — verify against a real
// response once a token is live, since this project hasn't seen live data yet.
const FEDERAL_AREAS = new Set(["US House", "US Senate"]);

async function handleRepsLookup(request, env) {
  const url = new URL(request.url);
  const zip = url.searchParams.get("zip");

  if (!zip || !/^\d{5}$/.test(zip)) {
    return jsonResponse({ error: "Provide a 5-digit zip code as ?zip=" }, 400);
  }

  if (!env.FIVECALLS_TOKEN) {
    return jsonResponse(
      { error: "Server isn't configured with a 5 Calls API token yet." },
      503
    );
  }

  let upstream;
  try {
    upstream = await fetch(`${FIVECALLS_BASE}?location=${zip}`, {
      headers: { "X-5Calls-Token": env.FIVECALLS_TOKEN },
    });
  } catch (err) {
    return jsonResponse({ error: "Couldn't reach the representative lookup service." }, 502);
  }

  if (!upstream.ok) {
    return jsonResponse(
      { error: `Lookup service returned an error (${upstream.status}).` },
      upstream.status === 429 ? 429 : 502
    );
  }

  const data = await upstream.json();

  const federal = (data.representatives || []).filter((r) => FEDERAL_AREAS.has(r.area));

  return jsonResponse({
    zip,
    lowAccuracy: !!data.lowAccuracy,
    state: data.state || null,
    district: data.district || null,
    representatives: federal.map((r) => ({
      name: r.name,
      phone: r.phone,
      url: r.url || null,
      party: r.party || null,
      area: r.area, // "US House" or "US Senate"
      district: r.district || null,
    })),
  });
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/reps") {
      return handleRepsLookup(request, env);
    }

    // Everything else: serve the static site unchanged.
    return env.ASSETS.fetch(request);
  },
};
