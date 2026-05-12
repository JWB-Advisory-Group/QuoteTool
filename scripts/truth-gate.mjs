import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "data", "truth-gate-addresses.sample.json");
const outputPath = path.join(root, "docs", "truth-gate-results.md");

const geocodeUrl =
  "https://gisservices.its.ny.gov/arcgis/rest/services/Locators/Street_and_Address_Composite/GeocodeServer/findAddressCandidates";
const nysParcelUrl =
  "https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1/query";

async function fetchJson(url, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${url}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return response.json();
}

async function geocode(singleLine) {
  const data = await fetchJson(geocodeUrl, {
    f: "json",
    SingleLine: singleLine,
    outFields: "*",
    maxLocations: "1",
  });
  const candidate = data.candidates?.[0] ?? null;
  return {
    candidate,
    resolved: Boolean(candidate && candidate.score >= 80),
  };
}

async function queryNysParcel(candidate) {
  if (!candidate?.location) return null;
  const data = await fetchJson(nysParcelUrl, {
    f: "json",
    geometry: `${candidate.location.x},${candidate.location.y}`,
    geometryType: "esriGeometryPoint",
    inSR: "26918",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      "COUNTY_NAME,SWIS_SBL_ID,SBL,PRINT_KEY,SQFT_LIVING,SQ_FT,YR_BLT,LOC_ZIP,ROLL_YR",
    returnGeometry: "false",
  });
  return data.features?.[0]?.attributes ?? null;
}

async function queryOptionalNassau(candidate) {
  const endpoint = process.env.NASSAU_PARCEL_QUERY_URL;
  if (!endpoint || !candidate?.location) return null;

  const data = await fetchJson(endpoint, {
    f: "json",
    geometry: `${candidate.location.x},${candidate.location.y}`,
    geometryType: "esriGeometryPoint",
    inSR: "26918",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "false",
  });
  return data.features?.[0]?.attributes ?? null;
}

function usable(parcel) {
  if (!parcel) return false;
  const sqft = parcel.SQFT_LIVING ?? parcel.SQ_FT;
  return Boolean(Number(sqft) > 0 && Number(parcel.YR_BLT) > 0);
}

function pct(count, total) {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

const raw = await readFile(inputPath, "utf8");
const addresses = JSON.parse(raw);
const rows = [];

for (const address of addresses) {
  const geo = await geocode(address.singleLine);
  const nysParcel = await queryNysParcel(geo.candidate);
  const nassauParcel =
    address.county?.toLowerCase() === "nassau"
      ? await queryOptionalNassau(geo.candidate)
      : null;
  const parcel = nysParcel ?? nassauParcel;

  rows.push({
    label: address.label,
    county: address.county,
    singleLine: address.singleLine,
    addressResolved: geo.resolved,
    geocodeScore: geo.candidate?.score ?? null,
    parcelResolved: Boolean(parcel),
    usableSqftYear: usable(parcel),
    source: nysParcel ? "nys_public_parcels" : nassauParcel ? "nassau_optional" : "none",
    parcelId: parcel?.SWIS_SBL_ID ?? parcel?.SBL ?? parcel?.PRINT_KEY ?? "",
    sqft: parcel?.SQFT_LIVING ?? parcel?.SQ_FT ?? "",
    yearBuilt: parcel?.YR_BLT ?? "",
  });
}

const totals = {
  addressResolved: rows.filter((row) => row.addressResolved).length,
  parcelResolved: rows.filter((row) => row.parcelResolved).length,
  usableSqftYear: rows.filter((row) => row.usableSqftYear).length,
};

const lines = [
  "# Truth Gate Results",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `Input file: \`${path.relative(root, inputPath)}\``,
  "",
  "| Metric | Result |",
  "| --- | --- |",
  `| Address resolved | ${totals.addressResolved}/${rows.length} (${pct(totals.addressResolved, rows.length)}) |`,
  `| Parcel resolved | ${totals.parcelResolved}/${rows.length} (${pct(totals.parcelResolved, rows.length)}) |`,
  `| Usable sqft/year built | ${totals.usableSqftYear}/${rows.length} (${pct(totals.usableSqftYear, rows.length)}) |`,
  "",
  "| Label | County | Address resolved | Parcel resolved | Usable sqft/year | Source | Parcel | Sqft | Year built |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| ${row.label} | ${row.county} | ${row.addressResolved ? "yes" : "no"} (${row.geocodeScore ?? "n/a"}) | ${row.parcelResolved ? "yes" : "no"} | ${row.usableSqftYear ? "yes" : "no"} | ${row.source} | ${row.parcelId || "n/a"} | ${row.sqft || "n/a"} | ${row.yearBuilt || "n/a"} |`,
  ),
  "",
  "Decision rule: ship Suffolk property enrichment only if the full 15-address run clears the threshold. If not, keep runtime pricing on customer-reported size plus manual market table.",
  "",
];

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, lines.join("\n"), "utf8");
console.log(`Wrote ${path.relative(root, outputPath)}`);
