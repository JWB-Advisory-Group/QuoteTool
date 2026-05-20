export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatMultiplier(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  const rounded = Number(value.toFixed(2));
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(rounded)}x`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundToFive(value: number) {
  return Math.round(value / 5) * 5;
}

const ZIP_INSIDE_CITY = /[\s,]+\d{5}(?:-\d{4})?\s*$/;

export function cleanStreet(street: string | null | undefined): string {
  if (!street) return "";
  return street.replace(/[\s,]+$/g, "").trim();
}

export function cleanCity(city: string | null | undefined): string {
  if (!city) return "";
  return city.replace(ZIP_INSIDE_CITY, "").trim();
}

export function cleanZip(zip: string | null | undefined): string {
  if (!zip) return "";
  return zip.trim();
}

export function formatAddressLine(
  street: string | null | undefined,
  city: string | null | undefined,
  zip: string | null | undefined,
): string {
  const parts = [cleanStreet(street), cleanCity(city), cleanZip(zip)]
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const [first, ...rest] = parts;
  return `${first}, ${rest.join(" ")}`;
}
