export type BusinessProfile = {
  name: string;
  ownerName: string;
  phone: string;
  phoneHref: string;
  serviceArea: string;
};

export const businessProfile: BusinessProfile = {
  name: "631 Solutions",
  ownerName: "Dante",
  phone: "(631) 850-3601",
  phoneHref: "tel:+16318503601",
  serviceArea: "Huntington / Suffolk County",
};

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
