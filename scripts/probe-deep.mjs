#!/usr/bin/env node
// Deeper probes — confirm severity of warnings from probe.mjs and check secondary surfaces.

import { faker } from "@faker-js/faker";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const SERVICES = [
  { slug: "house-wash", sizes: [1500, 2500, 3500, 5000], labels: ["Small", "Standard", "Large", "Estate"] },
];

const results = { pass: 0, warn: 0, fail: 0, findings: [] };
function record(severity, category, title, detail = "") {
  results[severity === "pass" ? "pass" : severity === "warn" ? "warn" : "fail"] += 1;
  if (severity !== "pass") results.findings.push({ severity, category, title, detail });
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null, text = "";
  try { text = await res.text(); json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text };
}
async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  let json = null, text = "";
  try { text = await res.text(); json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

function baseBody() {
  return {
    customerName: faker.person.fullName(),
    customerEmail: faker.internet.email().toLowerCase(),
    customerPhone: faker.phone.number({ style: "national" }),
    addressStreet: faker.location.streetAddress(),
    addressCity: "Huntington",
    addressZip: "11743",
    serviceSlug: "house-wash",
    jobSize: 2500,
    jobSizeLabel: "Standard",
    stories: 1,
    urgency: "this_week",
    source: "Nextdoor",
    notes: "probe",
    serviceLines: [{ serviceSlug: "house-wash", jobSize: 2500, jobSizeLabel: "Standard" }],
    serviceDetails: {},
    riskProfile: {},
    photoAttachments: [],
    preferredWindows: [],
  };
}

const head = (s) => console.log(`\n=== ${s} ===`);

async function check_protoPollution() {
  head("A. Confirm prototype-pollution payload does NOT mutate Object.prototype");
  // Send a request whose serialized JSON intentionally contains "__proto__" key
  // (note: faker bodies use object literals; we manually inject the rare path)
  const evilJson = JSON.stringify({ ...baseBody(), __proto__: { polluted: "yes" } });
  const before = ({}).polluted;
  const r = await post("/api/quotes", evilJson);
  const after = ({}).polluted;
  if (after !== undefined || before !== undefined) {
    record("fail", "attack", `Client-side prototype pollution detected (before=${before}, after=${after})`);
  } else {
    record("pass", "attack", "client Object.prototype not polluted");
  }
  // Try to detect server-side pollution via subsequent fetch (we can't directly inspect server memory,
  // but if any downstream endpoint suddenly returns "polluted" on a default object, that'd show)
  const listing = await get("/api/quotes");
  if (listing.text.includes('"polluted":"yes"')) {
    record("fail", "attack", "Server echoed prototype-poisoned value in /api/quotes listing");
  } else {
    record("pass", "attack", "no proto-pollution echo in listing");
  }
}

async function check_cronEffects() {
  head("B. /api/cron — does unauthenticated call actually fire side effects?");
  // First create a quote in 'sent' state that would be a candidate for follow-up.
  const create = await post("/api/quotes", baseBody());
  if (!create.ok) {
    record("fail", "cron", "could not seed quote for cron test");
    return;
  }
  // Trigger /send for that quote to put it into a sendable state
  const send = await post(`/api/quotes/${create.json.quoteId}/send`, { amount: 800, reviewConfirmed: true });
  // Now hit cron
  const cron = await get("/api/cron");
  if (cron.status >= 500) {
    record("fail", "cron", "/api/cron 5xx when hit unauthenticated", cron.text.slice(0, 200));
  } else if (cron.ok) {
    record("fail", "cron-security", "/api/cron is callable by ANY internet user", "Returns 200 without auth. Hosts the outcome-SMS fanout — anyone can trigger Twilio sends and rack up costs. Add an auth header check (e.g. Vercel `CRON_SECRET`) before the handler runs.");
  } else {
    record("warn", "cron", `/api/cron returned ${cron.status}`);
  }
  console.log("  cron response excerpt:", (cron.text || "").slice(0, 240));
}

async function check_ownerEndpointsOpen() {
  head("C. Owner-only mutation endpoints — auth gate?");
  // Seed quote
  const create = await post("/api/quotes", baseBody());
  if (!create.ok) {
    record("fail", "auth", "could not seed quote for owner-endpoint test");
    return;
  }
  const id = create.json.quoteId;
  // List of mutation endpoints that should arguably require owner auth
  const checks = [
    { path: `/api/quotes/${id}/send`, body: { amount: 800, reviewConfirmed: true } },
    { path: `/api/quotes/${id}/outcome`, body: { outcome: "won", amount: 800 } },
    { path: `/api/quotes/${id}/request-photos`, body: { channel: "sms" } },
    { path: `/api/quotes/${id}/follow-up`, body: { taskId: "manual_check_in", channel: "sms" } },
    { path: `/api/quotes/${id}/deposit`, body: {} },
    { path: `/api/cost-inputs/house-wash/onboard`, body: { typicalSize: 2000, typicalHours: 4, typicalCharge: 700, driveMinutes: 30 } },
    { path: `/api/cost-inputs/house-wash`, body: { hourlyLaborRate: 65, materialCostPerUnit: 12, equipmentWearPerHour: 4, hoursPerUnit: 2, driveReserveMinutes: 30, overheadPct: 0.18, minMarginPct: 0.4, serviceMinimum: 250, depositThreshold: 900, bufferActive: true }, method: "PATCH" },
  ];
  const open = [];
  const protected_ = [];
  for (const c of checks) {
    const method = c.method ?? "POST";
    const res = await fetch(`${BASE}${c.path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(c.body),
    });
    if (res.status === 401 || res.status === 403) {
      protected_.push(c.path);
    } else if (res.ok || res.status === 400) {
      open.push(`${method} ${c.path} → ${res.status}`);
    } else if (res.status >= 500) {
      record("fail", "auth", `${method} ${c.path} 5xx`, await res.text().then(t=>t.slice(0,200)));
    }
  }
  if (open.length > 0) {
    record("fail", "auth", `${open.length} owner-only endpoints accept unauthenticated requests`,
      `These endpoints are reachable without the DASHBOARD_PIN cookie:\n  ${open.join("\n  ")}\n\nReal-world risk: anyone on the internet who guesses or scrapes a quote ID (UUIDs are 128-bit but quote IDs appear in customer SMS/email links if Dante shares them) can:\n  • flip status to won/lost (poison the analytics)\n  • trigger Twilio SMS to the customer (spam, billable)\n  • change cost inputs (poison future pricing)\nMitigation: add a server-side auth check that mirrors the dashboard PIN session cookie. See lib/server/auth.ts.`);
  } else {
    record("pass", "auth", "all owner endpoints require auth");
  }
}

async function check_duplicateDetection() {
  head("D. Duplicate detection — same phone + same address");
  const phone = "(631) 555-9000";
  const street = "777 Probe Drive";
  const first = await post("/api/quotes", { ...baseBody(), customerPhone: phone, addressStreet: street });
  const second = await post("/api/quotes", { ...baseBody(), customerPhone: phone, addressStreet: street });
  if (!first.ok || !second.ok) {
    record("fail", "duplicate", "could not seed duplicates", `first=${first.status} second=${second.status}`);
    return;
  }
  // Look at listing for duplicate flag on the second one
  const listing = await get("/api/quotes");
  const q = listing.json?.quotes?.find((x) => x.id === second.json.quoteId);
  if (q?.duplicateContext?.isDuplicate) {
    record("pass", "duplicate", "second submission flagged as duplicate");
  } else {
    record("warn", "duplicate", "second submission NOT flagged as duplicate", JSON.stringify(q?.duplicateContext));
  }
}

async function check_lengthLimits() {
  head("E. Field-length limits — DB/UI bloat protection");
  const tests = [
    { field: "customerName", value: "A".repeat(500), schemaMax: 120 },
    { field: "addressStreet", value: "Q".repeat(800), schemaMax: 200 },
    { field: "addressCity", value: "Z".repeat(400), schemaMax: 100 },
    { field: "notes", value: faker.lorem.paragraphs(50), schemaMax: 2000 },
    { field: "source", value: "X".repeat(300), schemaMax: 80 },
  ];
  for (const t of tests) {
    const r = await post("/api/quotes", { ...baseBody(), [t.field]: t.value });
    if (r.status === 400) {
      record("pass", "limits", `rejected oversized ${t.field}`);
    } else if (r.ok) {
      // Round-trip
      const listing = await get("/api/quotes");
      const stored = listing.json?.quotes?.find((x) => x.id === r.json.quoteId)?.[t.field];
      const storedLen = (stored ?? "").length;
      if (storedLen >= t.value.length) {
        record("warn", "limits", `${t.field} accepts ${storedLen} chars unbounded`, `Suggested schema cap: ${t.schemaMax}. Stored value full-length will bloat the JSON store and may overflow SMS/email payloads downstream.`);
      } else {
        record("pass", "limits", `${t.field} stored truncated to ${storedLen}`);
      }
    } else {
      record("warn", "limits", `${t.field} oversized returned ${r.status}`, r.text.slice(0, 100));
    }
  }
}

async function check_controlChars() {
  head("F. Control characters — should be stripped or rejected");
  const r = await post("/api/quotes", { ...baseBody(), addressStreet: "123 \x00\x01\x02\x07Main\tSt\r\n", customerName: "Jane\x00 Test" });
  if (r.status === 400) {
    record("pass", "limits", "rejected control characters");
  } else if (r.ok) {
    const listing = await get("/api/quotes");
    const stored = listing.json?.quotes?.find((x) => x.id === r.json.quoteId);
    if (stored?.addressStreet?.includes("\x00")) {
      record("fail", "limits", "NUL byte persisted in addressStreet", "May break downstream SMS templates (\\x00 strings truncate in many C-based libs)");
    } else if (/[\x00-\x08\x0e-\x1f]/.test(stored?.addressStreet ?? "")) {
      record("warn", "limits", "control chars persisted in addressStreet (non-NUL)", JSON.stringify(stored?.addressStreet));
    } else {
      record("pass", "limits", "control chars not persisted");
    }
  }
}

async function check_concurrentWriteSafety() {
  head("G. Concurrent writes — file store race conditions");
  // The .data/pricing-agent.json is a single file. saveStore is async writeFile.
  // Two parallel POSTs read+modify+write. If not serialized, one write clobbers the other.
  const before = await get("/api/quotes");
  const beforeCount = (before.json?.quotes || []).length;
  const N = 50;
  const promises = Array.from({ length: N }, () => post("/api/quotes", baseBody()));
  await Promise.all(promises);
  const after = await get("/api/quotes");
  const afterCount = (after.json?.quotes || []).length;
  const added = afterCount - beforeCount;
  if (added < N) {
    record("fail", "concurrency", `lost ${N - added} writes to file-based store under parallel load`, `Wrote ${N} quotes concurrently; only ${added} persisted. The lib/server/store.ts saveStore is read-modify-write without a mutex; concurrent requests clobber each other. In production on serverless, the in-memory cache may also drift across instances. Mitigation: real DB (Postgres via Supabase is already a dep), or per-request append-only writes.`);
  } else {
    record("pass", "concurrency", `all ${N} parallel writes persisted`);
  }
}

async function check_emailVariants() {
  head("H. Email validation edge cases");
  const cases = [
    { v: "", expect: "ok" }, // empty is allowed (optional)
    { v: "plain@test.com", expect: "ok" },
    { v: "  spaced@test.com  ", expect: "ok" }, // trimmed
    { v: "name+tag@test.co.uk", expect: "ok" },
    { v: "a@b", expect: "rej" },
    { v: "a@", expect: "rej" },
    { v: "@b.com", expect: "rej" },
    { v: "a..b@x.com", expect: "any" }, // permissive — most validators allow
    { v: "test@123.45.67.89", expect: "any" },
  ];
  for (const c of cases) {
    const r = await post("/api/quotes", { ...baseBody(), customerEmail: c.v });
    if (c.expect === "ok" && r.ok) record("pass", "email", `accepted "${c.v}"`);
    else if (c.expect === "rej" && r.status === 400) record("pass", "email", `rejected "${c.v}"`);
    else if (c.expect === "rej" && r.ok) record("warn", "email", `accepted invalid email "${c.v}"`);
    else if (c.expect === "ok" && r.status === 400) record("warn", "email", `rejected valid email "${c.v}"`, r.text.slice(0, 100));
    else if (c.expect === "any") record("pass", "email", `boundary email "${c.v}" → ${r.status}`);
  }
}

async function main() {
  console.log("Deep probe — base:", BASE);
  faker.seed(0x1234);

  await check_protoPollution();
  await check_cronEffects();
  await check_ownerEndpointsOpen();
  await check_duplicateDetection();
  await check_lengthLimits();
  await check_controlChars();
  await check_concurrentWriteSafety();
  await check_emailVariants();

  console.log(`\n=== Report ===\npass=${results.pass}  warn=${results.warn}  fail=${results.fail}`);
  for (const f of results.findings) {
    console.log(`\n[${f.severity.toUpperCase()}] (${f.category}) ${f.title}`);
    if (f.detail) console.log("  " + f.detail.split("\n").join("\n  "));
  }
}

main().catch((e) => { console.error("crashed", e); process.exit(2); });
