#!/usr/bin/env node
// In-depth production-readiness probe.
// Run while the Next dev server is up on http://localhost:3000.

import { faker } from "@faker-js/faker";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const SERVICES = [
  { slug: "house-wash", sizes: [1500, 2500, 3500, 5000], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "window-cleaning", sizes: [20, 35, 55, 80], labels: ["Light", "Standard", "Large", "Estate"] },
  { slug: "roof-wash", sizes: [1500, 2500, 3500, 5000], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "gutters", sizes: [100, 150, 250, 350], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "patio-wash", sizes: [200, 400, 700, 1000], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "fence-wash", sizes: [100, 200, 350, 550], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "paver-refresh", sizes: [200, 400, 700, 1000], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "solar-panels", sizes: [12, 24, 40, 60], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "permanent-lighting", sizes: [80, 120, 180, 260], labels: ["Small", "Standard", "Large", "Estate"] },
  { slug: "painting", sizes: [1500, 2500, 3500, 5000], labels: ["Small", "Standard", "Large", "Estate"] },
];
const URGENCIES = ["asap", "this_week", "this_month", "flexible"];
const SUFFOLK_ZIPS = ["11743", "11746", "11787", "11731", "11724", "11790", "11725", "11953"];

const results = {
  pass: 0,
  fail: 0,
  warn: 0,
  findings: [],
};

function record(severity, category, title, detail = "") {
  results[severity === "pass" ? "pass" : severity === "warn" ? "warn" : "fail"] += 1;
  if (severity !== "pass") {
    results.findings.push({ severity, category, title, detail });
  }
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null;
  let text = "";
  try {
    text = await res.text();
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  let json = null;
  let text = "";
  try {
    text = await res.text();
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text };
}

function realisticQuote(overrides = {}) {
  const svc = faker.helpers.arrayElement(SERVICES);
  const idx = faker.number.int({ min: 0, max: svc.sizes.length - 1 });
  const phoneRaw = faker.phone.number({ style: "national" });
  return {
    customerName: faker.person.fullName(),
    customerEmail: faker.internet.email().toLowerCase(),
    customerPhone: phoneRaw,
    addressStreet: faker.location.streetAddress(),
    addressCity: faker.helpers.arrayElement([
      "Huntington",
      "Northport",
      "Smithtown",
      "Cold Spring Harbor",
      "Commack",
      "Dix Hills",
    ]),
    addressZip: faker.helpers.arrayElement(SUFFOLK_ZIPS),
    serviceSlug: svc.slug,
    jobSize: svc.sizes[idx],
    jobSizeLabel: svc.labels[idx],
    stories: faker.number.int({ min: 1, max: 3 }),
    urgency: faker.helpers.arrayElement(URGENCIES),
    source: faker.helpers.arrayElement([
      "Nextdoor",
      "Google",
      "Referral",
      "Truck QR",
      "Yard sign",
      "",
    ]),
    notes: faker.lorem.sentence(),
    serviceLines: [
      {
        serviceSlug: svc.slug,
        jobSize: svc.sizes[idx],
        jobSizeLabel: svc.labels[idx],
      },
    ],
    serviceDetails: {},
    riskProfile: {},
    photoAttachments: [],
    preferredWindows: [],
    ...overrides,
  };
}

const log = (...args) => console.log("·", ...args);
const head = (s) => console.log(`\n=== ${s} ===`);

async function suite_happyPath() {
  head("Suite 1: 200 happy-path submissions across all services");
  let failures = 0;
  const samples = [];
  const start = Date.now();
  for (let i = 0; i < 200; i++) {
    const body = realisticQuote();
    const r = await post("/api/quotes", body);
    if (!r.ok) {
      failures++;
      if (samples.length < 5) samples.push({ body, response: r });
      continue;
    }
    const { quoteId, rangeLow, rangeHigh, estimate } = r.json ?? {};
    if (!quoteId || typeof rangeLow !== "number" || typeof rangeHigh !== "number" || !estimate) {
      failures++;
      if (samples.length < 5) samples.push({ body, response: r });
    } else if (rangeLow > rangeHigh) {
      record("fail", "pricing", "Inverted price range", `quote ${quoteId}: low=${rangeLow} > high=${rangeHigh}`);
    } else if (rangeLow <= 0) {
      record("fail", "pricing", "Non-positive low range", `quote ${quoteId}: low=${rangeLow}`);
    }
  }
  const ms = Date.now() - start;
  log(`200 submissions in ${ms}ms`);
  if (failures > 0) {
    record("fail", "happy", `${failures}/200 happy-path submissions returned non-2xx`, JSON.stringify(samples[0], null, 2).slice(0, 800));
  } else {
    record("pass", "happy", "200/200 happy-path submissions accepted");
  }
}

async function suite_validation() {
  head("Suite 2: Validation should reject bad input");
  const cases = [
    { label: "missing name", body: { ...realisticQuote(), customerName: "" } },
    { label: "missing street", body: { ...realisticQuote(), addressStreet: "" } },
    { label: "missing city", body: { ...realisticQuote(), addressCity: "" } },
    { label: "missing zip", body: { ...realisticQuote(), addressZip: "" } },
    { label: "4-digit zip", body: { ...realisticQuote(), addressZip: "1234" } },
    { label: "6-digit zip", body: { ...realisticQuote(), addressZip: "117430" } },
    { label: "letters in zip", body: { ...realisticQuote(), addressZip: "ABCDE" } },
    { label: "negative jobSize", body: { ...realisticQuote(), jobSize: -100 } },
    { label: "zero jobSize", body: { ...realisticQuote(), jobSize: 0 } },
    { label: "huge stories", body: { ...realisticQuote(), stories: 99 } },
    { label: "bad email", body: { ...realisticQuote(), customerEmail: "not-an-email" } },
    { label: "missing serviceSlug", body: { ...realisticQuote(), serviceSlug: "" } },
    { label: "unknown serviceSlug", body: { ...realisticQuote(), serviceSlug: "magic-beans" } },
    { label: "missing urgency", body: { ...realisticQuote(), urgency: "" } },
    { label: "stories 0", body: { ...realisticQuote(), stories: 0 } },
  ];
  for (const tc of cases) {
    const r = await post("/api/quotes", tc.body);
    if (r.status === 400) {
      record("pass", "validation", `rejected "${tc.label}"`);
    } else if (tc.label === "unknown serviceSlug" && r.ok) {
      // pricing engine may still return a quote with empty serviceLines — flag
      record("warn", "validation", `accepted unknown serviceSlug "${tc.body.serviceSlug}"`, `status=${r.status}`);
    } else {
      record("fail", "validation", `did NOT reject "${tc.label}"`, `status=${r.status} body=${(r.text || "").slice(0, 200)}`);
    }
  }
}

async function suite_attack() {
  head("Suite 3: Attack surface");
  const payloads = [
    { label: "XSS in customerName", body: { ...realisticQuote(), customerName: '<script>alert(1)</script>' } },
    { label: "XSS in notes", body: { ...realisticQuote(), notes: "javascript:alert(1)" } },
    { label: "SQL-shaped customerName", body: { ...realisticQuote(), customerName: "Robert'); DROP TABLE quotes;--" } },
    { label: "prototype pollution __proto__", body: { ...realisticQuote(), __proto__: { polluted: true } } },
    { label: "extremely long name (10k chars)", body: { ...realisticQuote(), customerName: "A".repeat(10000) } },
    { label: "Unicode/emoji name", body: { ...realisticQuote(), customerName: "👨‍🚀 Jane O'Sullivan-Pérez 中文 🚿" } },
    { label: "ZIP with newline injection", body: { ...realisticQuote(), addressZip: "11743\nBcc:evil@x.com" } },
    { label: "control chars in street", body: { ...realisticQuote(), addressStreet: "123\x00\x01Main\tSt" } },
    { label: "deeply nested object as notes", body: { ...realisticQuote(), notes: { a: { b: { c: "x" } } } } },
    { label: "negative jobSize coerced", body: { ...realisticQuote(), jobSize: "-100" } },
    { label: "boolean true as serviceSlug", body: { ...realisticQuote(), serviceSlug: true } },
    { label: "array as customerName", body: { ...realisticQuote(), customerName: ["A", "B"] } },
  ];
  for (const tc of payloads) {
    const r = await post("/api/quotes", tc.body);
    // None should crash (5xx). Most should either reject or accept-with-sanitization.
    if (r.status >= 500) {
      record("fail", "attack", `5xx on "${tc.label}"`, `status=${r.status} body=${(r.text || "").slice(0, 300)}`);
      continue;
    }
    if (r.ok && tc.label.startsWith("XSS")) {
      // Check the echoed JSON for unsanitized script — server data is consumed by SSR later
      const echoed = JSON.stringify(r.json);
      if (echoed.includes("<script>") || echoed.includes("javascript:")) {
        record("warn", "attack", `XSS payload echoed unsanitized in "${tc.label}"`, `Risk: stored XSS if rendered as innerHTML. Mitigated only by React's text-by-default escaping. Recommend explicit allowlist.`);
      } else {
        record("pass", "attack", `XSS payload neutralized in "${tc.label}"`);
      }
    } else if (r.status === 400) {
      record("pass", "attack", `rejected "${tc.label}"`);
    } else if (r.ok) {
      record("warn", "attack", `accepted suspicious "${tc.label}"`, `status=${r.status}`);
    } else {
      record("pass", "attack", `non-2xx for "${tc.label}" (status=${r.status})`);
    }
  }

  // Oversized photo dataUrl
  const bigPhoto = "data:image/png;base64," + "A".repeat(3_000_000);
  const r = await post("/api/quotes", {
    ...realisticQuote(),
    photoAttachments: [{ id: faker.string.uuid(), name: "huge.png", dataUrl: bigPhoto }],
  });
  if (r.status >= 500) {
    record("fail", "attack", `5xx on oversized photo`, `status=${r.status}`);
  } else if (r.status === 400 || r.status === 413) {
    record("pass", "attack", `rejected oversized photo dataUrl (>2.6MB)`);
  } else {
    record("warn", "attack", `accepted oversized photo dataUrl`, `status=${r.status}`);
  }

  // Non-image dataUrl
  const badData = await post("/api/quotes", {
    ...realisticQuote(),
    photoAttachments: [{ id: faker.string.uuid(), name: "evil.txt", dataUrl: "data:text/plain;base64,SGVsbG8=" }],
  });
  if (badData.status === 400) record("pass", "attack", `rejected non-image dataUrl`);
  else record("warn", "attack", `accepted non-image dataUrl`, `status=${badData.status}`);
}

async function suite_actionEndpoints() {
  head("Suite 4: Quote action endpoints");
  // Create a base quote to act on
  const baseBody = realisticQuote();
  const created = await post("/api/quotes", baseBody);
  if (!created.ok) {
    record("fail", "actions", "could not seed quote for action tests", JSON.stringify(created).slice(0, 200));
    return;
  }
  const id = created.json.quoteId;

  // /send — happens before sendReview? auth gate?
  const sendNoAuth = await post(`/api/quotes/${id}/send`, { amount: 800, reviewConfirmed: true });
  if (sendNoAuth.status === 401 || sendNoAuth.status === 403) {
    record("pass", "actions", "/send requires auth");
  } else if (sendNoAuth.status === 200 || sendNoAuth.status === 201) {
    record("warn", "actions", "/send accepted without auth (PIN unset → owner endpoints open)");
  } else if (sendNoAuth.status >= 500) {
    record("fail", "actions", `/send 5xx`, sendNoAuth.text.slice(0, 200));
  } else {
    record("pass", "actions", `/send returned ${sendNoAuth.status}`);
  }

  // /send with garbage
  const sendBad = await post(`/api/quotes/${id}/send`, { amount: -100 });
  if (sendBad.status === 400) record("pass", "actions", `/send rejected negative amount`);
  else if (sendBad.status >= 500) record("fail", "actions", `/send 5xx on negative amount`, sendBad.text.slice(0, 200));
  else record("warn", "actions", `/send accepted negative amount`, `status=${sendBad.status}`);

  // /approve before /send
  const approveEarly = await post(`/api/quotes/${id}/approve`, {
    selectedPackageId: "best_value",
    selectedPrice: 900,
    scopeAccepted: true,
  });
  if (approveEarly.status >= 500) record("fail", "actions", `/approve 5xx`, approveEarly.text.slice(0, 200));
  else record("pass", "actions", `/approve responded ${approveEarly.status}`);

  // /approve with crazy values
  const approveCrazy = await post(`/api/quotes/${id}/approve`, {
    selectedPackageId: "best_value",
    selectedPrice: 9999999999,
    scopeAccepted: true,
    acceptedUpsellsLift: 50000, // over schema max
  });
  if (approveCrazy.status === 400) record("pass", "actions", `/approve rejected over-cap upsell lift`);
  else if (approveCrazy.status >= 500) record("fail", "actions", `/approve 5xx`, approveCrazy.text.slice(0, 200));
  else record("warn", "actions", `/approve accepted suspect values`, `status=${approveCrazy.status}`);

  // /outcome with bad enum
  const outcomeBad = await post(`/api/quotes/${id}/outcome`, { outcome: "totally_lost" });
  if (outcomeBad.status === 400) record("pass", "actions", `/outcome rejected unknown enum`);
  else if (outcomeBad.status >= 500) record("fail", "actions", `/outcome 5xx`, outcomeBad.text.slice(0, 200));
  else record("warn", "actions", `/outcome accepted unknown enum`, `status=${outcomeBad.status}`);

  // /outcome — valid won
  const outcomeWon = await post(`/api/quotes/${id}/outcome`, {
    outcome: "won",
    amount: 850,
    notes: "Smoke test",
  });
  if (outcomeWon.ok) record("pass", "actions", `/outcome accepted valid won`);
  else if (outcomeWon.status >= 500) record("fail", "actions", `/outcome 5xx on valid won`, outcomeWon.text.slice(0, 200));
  else record("warn", "actions", `/outcome rejected valid won`, `status=${outcomeWon.status} ${outcomeWon.text.slice(0,200)}`);

  // /request-photos
  const photoReq = await post(`/api/quotes/${id}/request-photos`, { channel: "both" });
  if (photoReq.status >= 500) record("fail", "actions", `/request-photos 5xx`, photoReq.text.slice(0, 200));
  else record("pass", "actions", `/request-photos responded ${photoReq.status}`);

  // /follow-up
  const followUp = await post(`/api/quotes/${id}/follow-up`, { taskId: "manual_check_in", channel: "sms" });
  if (followUp.status >= 500) record("fail", "actions", `/follow-up 5xx`, followUp.text.slice(0, 200));
  else record("pass", "actions", `/follow-up responded ${followUp.status}`);

  // /deposit
  const deposit = await post(`/api/quotes/${id}/deposit`, {});
  if (deposit.status >= 500) record("fail", "actions", `/deposit 5xx`, deposit.text.slice(0, 200));
  else record("pass", "actions", `/deposit responded ${deposit.status}`);

  // Action on a non-existent ID
  const ghost = await post(`/api/quotes/ghost-id-xyz/outcome`, { outcome: "won", amount: 100 });
  if (ghost.status === 404) record("pass", "actions", `/outcome 404 on missing quote`);
  else if (ghost.status >= 500) record("fail", "actions", `/outcome 5xx on missing quote`, ghost.text.slice(0, 200));
  else record("warn", "actions", `/outcome returned ${ghost.status} on missing quote`);

  // Action on a clearly wrong id format (path traversal-ish)
  const trav = await post(`/api/quotes/..%2F..%2Fetc%2Fpasswd/outcome`, { outcome: "won", amount: 1 });
  if (trav.status >= 500) record("fail", "actions", `path-traversal id 5xx`, trav.text.slice(0, 200));
  else record("pass", "actions", `path-traversal id handled (status=${trav.status})`);
}

async function suite_webhooks() {
  head("Suite 5: Webhooks");
  // Twilio inbound — server expects form-encoded body
  const validTw = await fetch(`${BASE}/api/webhooks/twilio-inbound`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: "+16315551234", Body: "WON 625" }).toString(),
  });
  const tStatus = validTw.status;
  if (tStatus >= 500) {
    const t = await validTw.text();
    record("fail", "webhooks", `twilio webhook 5xx on WON 625`, t.slice(0, 300));
  } else {
    record("pass", "webhooks", `twilio webhook responded ${tStatus} on WON 625`);
  }
  // Twilio with random gibberish body
  const gib = await fetch(`${BASE}/api/webhooks/twilio-inbound`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: "+16315551234", Body: "🙃🙃🙃" }).toString(),
  });
  if (gib.status >= 500) {
    const t = await gib.text();
    record("fail", "webhooks", `twilio 5xx on emoji body`, t.slice(0, 200));
  } else {
    record("pass", "webhooks", `twilio handled emoji body (${gib.status})`);
  }

  // Twilio with empty body
  const empty = await fetch(`${BASE}/api/webhooks/twilio-inbound`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "",
  });
  if (empty.status >= 500) {
    const t = await empty.text();
    record("fail", "webhooks", `twilio 5xx on empty body`, t.slice(0, 200));
  } else {
    record("pass", "webhooks", `twilio handled empty body (${empty.status})`);
  }

  // Stripe — should reject unsigned/invalid signature
  const stripeUnsigned = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test" } } }),
  });
  if (stripeUnsigned.status === 400 || stripeUnsigned.status === 401) {
    record("pass", "webhooks", `stripe rejected unsigned payload (${stripeUnsigned.status})`);
  } else if (stripeUnsigned.status >= 500) {
    const t = await stripeUnsigned.text();
    record("fail", "webhooks", `stripe 5xx on unsigned payload`, t.slice(0, 200));
  } else {
    record("warn", "webhooks", `stripe accepted unsigned payload (${stripeUnsigned.status})`);
  }

  // Cron endpoint should be POST or have an auth check
  const cron = await get("/api/cron");
  if (cron.status === 401 || cron.status === 403) {
    record("pass", "webhooks", `/api/cron rejected unauthenticated GET`);
  } else if (cron.status >= 500) {
    record("fail", "webhooks", `/api/cron 5xx`, cron.text.slice(0, 200));
  } else if (cron.ok) {
    record("warn", "webhooks", `/api/cron accepts unauthenticated GET`, `status=${cron.status}`);
  } else {
    record("pass", "webhooks", `/api/cron returned ${cron.status}`);
  }
}

async function suite_pricingSweep() {
  head("Suite 6: Pricing engine sweep — every service × every size × edge urgencies");
  const issues = [];
  for (const svc of SERVICES) {
    for (let i = 0; i < svc.sizes.length; i++) {
      for (const urgency of URGENCIES) {
        const r = await post("/api/quotes", {
          ...realisticQuote(),
          serviceSlug: svc.slug,
          jobSize: svc.sizes[i],
          jobSizeLabel: svc.labels[i],
          urgency,
          serviceLines: [{ serviceSlug: svc.slug, jobSize: svc.sizes[i], jobSizeLabel: svc.labels[i] }],
          stories: 1,
        });
        if (!r.ok) {
          issues.push(`${svc.slug}/${svc.labels[i]}/${urgency} → ${r.status} ${r.text.slice(0,80)}`);
          continue;
        }
        const e = r.json.estimate;
        if (!e) {
          issues.push(`${svc.slug}/${svc.labels[i]}/${urgency}: no estimate`);
          continue;
        }
        if (e.rangeLow > e.rangeHigh) issues.push(`${svc.slug}/${svc.labels[i]}/${urgency}: inverted range ${e.rangeLow}>${e.rangeHigh}`);
        if (e.recommendedAsk < e.rangeLow || e.recommendedAsk > e.rangeHigh) issues.push(`${svc.slug}/${svc.labels[i]}/${urgency}: ask ${e.recommendedAsk} outside [${e.rangeLow},${e.rangeHigh}]`);
        if (e.protectedFloor && e.recommendedAsk < e.protectedFloor) issues.push(`${svc.slug}/${svc.labels[i]}/${urgency}: ask ${e.recommendedAsk} below floor ${e.protectedFloor}`);
        if (e.profitability && e.profitability.grossMarginPct < 0) issues.push(`${svc.slug}/${svc.labels[i]}/${urgency}: NEGATIVE margin ${e.profitability.grossMarginPct}%`);
      }
    }
  }
  if (issues.length === 0) {
    record("pass", "pricing", `swept ${SERVICES.length} services × ${4} sizes × ${URGENCIES.length} urgencies (${SERVICES.length*4*URGENCIES.length} combos)`);
  } else {
    record("fail", "pricing", `${issues.length} pricing anomalies`, issues.slice(0, 15).join("\n"));
  }
}

async function suite_concurrency() {
  head("Suite 7: Concurrency — 30 parallel quote submissions");
  const start = Date.now();
  const promises = Array.from({ length: 30 }, () => post("/api/quotes", realisticQuote()));
  const responses = await Promise.all(promises);
  const ms = Date.now() - start;
  const okCount = responses.filter((r) => r.ok).length;
  const ids = responses.filter((r) => r.ok).map((r) => r.json.quoteId);
  const unique = new Set(ids).size;
  if (okCount < 30) {
    record("warn", "concurrency", `${30-okCount}/30 parallel submissions failed`, `first failure: ${responses.find(r=>!r.ok)?.text?.slice(0,200)}`);
  } else if (unique !== okCount) {
    record("fail", "concurrency", `duplicate quote IDs (${okCount-unique})`);
  } else {
    record("pass", "concurrency", `30 parallel submissions in ${ms}ms, all unique IDs`);
  }

  // Now check listing returns at least 30 + base
  const listing = await get("/api/quotes");
  if (!listing.ok) {
    record("fail", "concurrency", `GET /api/quotes failed`, listing.text.slice(0, 200));
  } else {
    record("pass", "concurrency", `GET /api/quotes returned ${(listing.json?.quotes || []).length} quotes`);
  }
}

async function suite_addressEdges() {
  head("Suite 8: Address sanitization edge cases");
  const variants = [
    { label: "trailing comma", body: { ...realisticQuote(), addressStreet: "123 Main St,", addressCity: "Huntington", addressZip: "11743" } },
    { label: "city contains zip", body: { ...realisticQuote(), addressStreet: "456 Pine", addressCity: "Huntington 11743", addressZip: "11743" } },
    { label: "trailing whitespace", body: { ...realisticQuote(), addressStreet: "789 Oak   ", addressCity: "  Northport ", addressZip: "11768" } },
    { label: "city contains zip+4", body: { ...realisticQuote(), addressStreet: "100 Elm", addressCity: "Smithtown 11787-1234", addressZip: "11787" } },
  ];
  for (const v of variants) {
    const r = await post("/api/quotes", v.body);
    if (!r.ok) {
      record("fail", "address", `submission failed for "${v.label}"`, r.text.slice(0,200));
      continue;
    }
    const id = r.json.quoteId;
    // Fetch via /api/quotes and look at the stored values
    const list = await get("/api/quotes");
    const q = list.json?.quotes?.find((x) => x.id === id);
    if (!q) {
      record("fail", "address", `stored quote not found for "${v.label}"`);
      continue;
    }
    const street = q.addressStreet;
    const city = q.addressCity;
    if (street.endsWith(",") || street.endsWith(" ")) {
      record("fail", "address", `street not sanitized for "${v.label}"`, `got "${street}"`);
    } else if (/\d{5}/.test(city)) {
      record("fail", "address", `city still contains ZIP for "${v.label}"`, `got "${city}"`);
    } else {
      record("pass", "address", `sanitized "${v.label}" → "${street}" / "${city}"`);
    }
  }
}

async function suite_unauthDashboardPages() {
  head("Suite 9: SSR pages should not 500");
  const pages = [
    "/quote",
    "/dashboard",
    "/dashboard/costs",
    "/dashboard/onboarding",
  ];
  for (const p of pages) {
    const r = await get(p);
    if (r.status >= 500) {
      record("fail", "ssr", `SSR 5xx on ${p}`, r.text.slice(0, 200));
    } else {
      record("pass", "ssr", `SSR ${r.status} on ${p}`);
    }
  }
  // Non-existent quote detail
  const ghost = await get("/quote/this-quote-does-not-exist");
  if (ghost.status === 404) record("pass", "ssr", "missing customer quote → 404");
  else if (ghost.status >= 500) record("fail", "ssr", "missing customer quote 5xx", ghost.text.slice(0, 200));
  else record("warn", "ssr", `missing customer quote → ${ghost.status}`);

  const ownerGhost = await get("/dashboard/quotes/this-quote-does-not-exist");
  if (ownerGhost.status === 404) record("pass", "ssr", "missing owner quote → 404");
  else if (ownerGhost.status >= 500) record("fail", "ssr", "missing owner quote 5xx", ownerGhost.text.slice(0, 200));
  else record("warn", "ssr", `missing owner quote → ${ownerGhost.status}`);
}

async function main() {
  console.log("Production-readiness probe — base:", BASE);
  console.log("Faker seed:", faker.seed(0xc0ffee));
  const overallStart = Date.now();

  await suite_happyPath();
  await suite_validation();
  await suite_attack();
  await suite_actionEndpoints();
  await suite_webhooks();
  await suite_pricingSweep();
  await suite_concurrency();
  await suite_addressEdges();
  await suite_unauthDashboardPages();

  const totalMs = Date.now() - overallStart;
  head("Report");
  console.log(`pass=${results.pass}  warn=${results.warn}  fail=${results.fail}  total=${results.pass + results.warn + results.fail}  time=${totalMs}ms`);
  if (results.findings.length > 0) {
    for (const f of results.findings) {
      console.log(`\n[${f.severity.toUpperCase()}] (${f.category}) ${f.title}`);
      if (f.detail) console.log("  " + f.detail.split("\n").join("\n  "));
    }
  }

  process.exitCode = results.fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("probe crashed:", e);
  process.exit(2);
});
