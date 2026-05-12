import type { AddressValidation } from "@/lib/types";

const suffolkZips = new Set<string>([
  "11701", "11702", "11703", "11704", "11705", "11706", "11707", "11713",
  "11715", "11716", "11717", "11718", "11719", "11720", "11721", "11722",
  "11724", "11725", "11726", "11727", "11729", "11730", "11731", "11733",
  "11738", "11739", "11740", "11741", "11742", "11743", "11746", "11747",
  "11749", "11751", "11752", "11754", "11755", "11757", "11760", "11763",
  "11764", "11766", "11767", "11768", "11769", "11770", "11772", "11776",
  "11777", "11778", "11779", "11780", "11782", "11784", "11786", "11787",
  "11788", "11789", "11790", "11792", "11794", "11795", "11796", "11798",
  "11901", "11930", "11931", "11932", "11933", "11934", "11935", "11937",
  "11939", "11940", "11941", "11942", "11944", "11946", "11947", "11948",
  "11949", "11950", "11951", "11952", "11953", "11954", "11955", "11956",
  "11957", "11958", "11959", "11960", "11961", "11962", "11963", "11964",
  "11965", "11967", "11968", "11969", "11970", "11971", "11972", "11973",
  "11975", "11976", "11977", "11978", "11980",
]);

const nassauZips = new Set<string>([
  "11001", "11002", "11003", "11004", "11005", "11020", "11021", "11022",
  "11023", "11024", "11026", "11027", "11030", "11040", "11042", "11050",
  "11096", "11501", "11507", "11509", "11510", "11514", "11516", "11518",
  "11520", "11530", "11542", "11545", "11547", "11548", "11549", "11550",
  "11552", "11553", "11554", "11556", "11557", "11558", "11559", "11560",
  "11561", "11563", "11565", "11566", "11568", "11569", "11570", "11572",
  "11575", "11576", "11577", "11579", "11580", "11581", "11590", "11596",
  "11598", "11691", "11692", "11693", "11694",
]);

const queensZips = new Set<string>([
  "11004", "11101", "11102", "11103", "11104", "11105", "11106", "11354",
  "11355", "11356", "11357", "11358", "11359", "11360", "11361", "11362",
  "11363", "11364", "11365", "11366", "11367", "11368", "11369", "11370",
  "11372", "11373", "11374", "11375", "11377", "11378", "11379", "11385",
  "11411", "11412", "11413", "11414", "11415", "11416", "11417", "11418",
  "11419", "11420", "11421", "11422", "11423", "11426", "11427", "11428",
  "11429", "11432", "11433", "11434", "11435", "11436", "11691",
]);

const coreHuntingtonZips = new Set<string>([
  "11743", "11746", "11747", "11721", "11725", "11731", "11788", "11787",
]);

function detectCounty(zip: string): AddressValidation["county"] {
  if (suffolkZips.has(zip)) return "Suffolk";
  if (nassauZips.has(zip)) return "Nassau";
  if (queensZips.has(zip)) return "Queens";
  if (/^11\d{3}$/.test(zip)) return "Other";
  return "Unknown";
}

const streetSuffixes = [
  "st", "street", "ave", "avenue", "rd", "road", "dr", "drive", "blvd",
  "boulevard", "ln", "lane", "ct", "court", "pl", "place", "way", "ter",
  "terrace", "trl", "trail", "cir", "circle", "pkwy", "parkway", "hwy",
  "highway", "row", "loop", "path", "walk", "sq", "square", "run", "ridge",
  "view", "crossing", "spur", "alley", "mews", "neck", "hollow", "estates",
];

function looksLikeRealStreet(street: string) {
  const trimmed = street.trim();
  if (trimmed.length < 5) return false;
  if (!/^\d+\w*\s+\S/.test(trimmed)) return false;
  const tokens = trimmed.toLowerCase().replace(/[,.]/g, "").split(/\s+/);
  return tokens.some((token) => streetSuffixes.includes(token));
}

function looksLikeRealCity(city: string) {
  return city.trim().length >= 2 && /[a-zA-Z]/.test(city);
}

export function validateAddress(input: {
  street: string;
  city: string;
  zip: string;
}): AddressValidation {
  const zip = input.zip.trim();
  const street = input.street.trim();
  const city = input.city.trim();
  const county = detectCounty(zip);
  const warnings: string[] = [];

  if (!/^\d{5}$/.test(zip)) {
    warnings.push("ZIP is not a valid 5-digit code.");
  }
  if (!looksLikeRealStreet(street)) {
    warnings.push("Street address is missing a number or street suffix.");
  }
  if (!looksLikeRealCity(city)) {
    warnings.push("Town/city field looks empty or invalid.");
  }
  if (county === "Unknown") {
    warnings.push("ZIP does not match a Long Island / NYC area code.");
  }
  if (county === "Queens") {
    warnings.push("Queens addresses are outside the normal service route; surcharge applies.");
  }
  if (county === "Other") {
    warnings.push("ZIP is in 11xxx range but not Suffolk, Nassau, or Queens.");
  }

  const inServiceArea = county === "Suffolk" || county === "Nassau";
  const isCoreRoute = coreHuntingtonZips.has(zip);

  let confidence: AddressValidation["confidence"];
  if (warnings.length === 0 && isCoreRoute) {
    confidence = "verified";
  } else if (warnings.length === 0 && inServiceArea) {
    confidence = "plausible";
  } else if (inServiceArea && warnings.length <= 1) {
    confidence = "plausible";
  } else if (!inServiceArea && county !== "Unknown") {
    confidence = "out_of_area";
  } else {
    confidence = "unverified";
  }

  const routeZone =
    isCoreRoute
      ? "Core Huntington route"
      : county === "Suffolk"
        ? "Suffolk route"
        : county === "Nassau"
          ? "Nassau route"
          : county === "Queens"
            ? "Queens / out-of-route"
            : "Manual service-area review";

  const ownerAction =
    confidence === "verified"
      ? "Address looks clean and in route — proceed."
      : confidence === "plausible"
        ? "Address looks reasonable — confirm with customer if anything looks off."
        : confidence === "out_of_area"
          ? "Outside Suffolk / Nassau — decide whether to take the job or decline politely."
          : "Address could not be verified — call customer to confirm before driving out.";

  return {
    confidence,
    inServiceArea,
    county,
    routeZone,
    warnings,
    ownerAction,
  };
}

export function isCoreRoute(zip: string) {
  return coreHuntingtonZips.has(zip.trim());
}
