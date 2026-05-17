import type { Service } from "@/lib/types";

export const urgencyAdjustments: Record<string, number> = {
  asap: 1.16,
  this_week: 1.08,
  this_month: 1,
  flexible: 0.97,
};

export const urgencyOptions = [
  { value: "asap", label: "ASAP" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "flexible", label: "Flexible" },
];

export const defaultDriveReserveMinutes: Record<string, number> = {
  "house-wash": 30,
  "window-cleaning": 30,
  "roof-wash": 40,
  gutters: 30,
  "patio-wash": 30,
  "fence-wash": 35,
  "paver-refresh": 40,
  "solar-panels": 30,
  "permanent-lighting": 45,
  painting: 45,
};

export const defaultServiceMinimums: Record<string, number> = {
  "house-wash": 350,
  "window-cleaning": 225,
  "roof-wash": 650,
  gutters: 225,
  "patio-wash": 225,
  "fence-wash": 275,
  "paver-refresh": 500,
  "solar-panels": 225,
  "permanent-lighting": 900,
  painting: 750,
};

export const serviceLeadValueWeights: Record<string, number> = {
  "permanent-lighting": 13,
  painting: 11,
  "roof-wash": 10,
  "paver-refresh": 8,
  "house-wash": 7,
  "fence-wash": 5,
  "window-cleaning": 5,
  gutters: 4,
  "patio-wash": 4,
  "solar-panels": 3,
};

export const propertyTypeLabels = {
  single_family: "Single-family home",
  townhome: "Townhome",
  condo: "Condo",
  multi_family: "Multi-family",
  commercial: "Small commercial",
  hoa: "HOA / association",
  other: "Other",
} as const;

export const preferredContactLabels = {
  text: "Text",
  call: "Call",
  email: "Email",
} as const;

export const serviceScopes: Record<string, { include: string[]; exclude: string[] }> = {
  "house-wash": {
    include: [
      "Soft wash of exterior siding, trim, soffits, and accessible exterior surfaces",
      "Standard algae and organic growth treatment",
    ],
    exclude: [
      "Oxidation removal, paint correction, detached structures, and interior windows",
      "Moving heavy furniture or clearing locked access points",
    ],
  },
  "window-cleaning": {
    include: ["Exterior glass cleaning for selected window count"],
    exclude: [
      "Storm windows, hard water removal, tracks, and screens unless added to scope",
    ],
  },
  "roof-wash": {
    include: ["Soft wash roof treatment with plant and runoff protection planning"],
    exclude: ["Roof repairs, roof walking guarantees, and gutter repairs"],
  },
  gutters: {
    include: ["Gutter cleanout for selected linear footage"],
    exclude: ["Gutter repairs, underground drain clearing, and guard removal unless noted"],
  },
  "patio-wash": {
    include: ["Surface wash for selected patio or walkway square footage"],
    exclude: ["Sealing, sanding, rust/oil treatment, and furniture moving unless noted"],
  },
  "fence-wash": {
    include: ["Fence wash for selected linear footage and normal organic buildup"],
    exclude: ["Stain removal, old paint risk, repairs, and both sides unless noted"],
  },
  "paver-refresh": {
    include: ["Paver surface cleaning and restoration review for selected square footage"],
    exclude: ["Polymeric sand, sealing, failed sealer removal, and weed remediation unless quoted"],
  },
  "solar-panels": {
    include: ["Solar panel rinse/cleaning for selected panel count"],
    exclude: ["Electrical diagnostics, roof repairs, and unsafe roof access"],
  },
  "permanent-lighting": {
    include: ["Permanent lighting lead intake and budgetary install range"],
    exclude: ["Electrical upgrades, custom controls, and final install survey"],
  },
  painting: {
    include: ["Painting lead intake and budgetary project range"],
    exclude: ["Repairs, lead paint remediation, and final paint/material selection"],
  },
};

export const photoRequirementsByService: Record<string, string[]> = {
  "house-wash": ["Front of home", "Left and right sides", "Worst green/dirty area"],
  "window-cleaning": ["Front windows", "Screens/storm windows if present", "Any high or hard-water glass"],
  "roof-wash": ["Roof from front", "Roof from back/side", "Heavy moss or black streaks", "Landscaping under roofline"],
  gutters: ["Front gutter line", "Highest gutter section", "Any guards or downspout issue"],
  "patio-wash": ["Full patio/walkway", "Furniture or obstacles", "Worst stains"],
  "fence-wash": ["Full fence run", "Close-up of buildup", "Both sides if requested"],
  "paver-refresh": ["Full paver area", "Close-up of joints", "Sealer/weeds/stains"],
  "solar-panels": ["Panel layout", "Roof access angle"],
  "permanent-lighting": ["Front roofline", "Corners/returns", "Power/control location"],
  painting: ["Each side/room", "Damaged surfaces", "Paint failure or repairs"],
};

export function serviceUnitCount(service: Service, jobSize: number) {
  if (service.unit === "per_1000_sqft") return jobSize / 1000;
  if (service.unit === "per_100_sqft") return jobSize / 100;
  if (service.unit === "per_100_linear_ft") return jobSize / 100;
  if (service.unit === "per_window") return jobSize;
  if (service.unit === "per_panel") return jobSize;
  return 1;
}
