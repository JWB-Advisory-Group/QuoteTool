"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ClipboardCheck,
  Check,
  ChevronDown,
  Eye,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import type {
  AccessConcern,
  PreferredContactMethod,
  PreferredWindow,
  PropertyType,
  QuoteRiskProfile,
  QuoteServiceDetails,
  QuoteServiceLine,
  Service,
  WindowDetail,
} from "@/lib/types";
import { urgencyOptions } from "@/lib/pricing";
import { preferredContactLabels, propertyTypeLabels } from "@/lib/pricing-config";
import { MAX_QUOTE_PHOTOS } from "@/lib/photo-limits";
import {
  type ClientPhoto,
  type PhotoReadResult,
  clientPhotosToAttachments,
  readPhoto,
} from "@/app/quote/photo-pipeline";
import { ResultPanel, type SubmitResult } from "@/app/quote/quote-result-panel";
import {
  NumberDetail,
  SelectDetail,
  ToggleGroup,
} from "@/app/quote/quote-form-fields";

export { QuoteTrustRail } from "@/app/quote/quote-trust-rail";

type FormState = {
  serviceSlug: string;
  jobSize: number;
  jobSizeLabel: string;
  serviceLines: QuoteServiceLine[];
  stories: number;
  urgency: string;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preferredContactMethod: PreferredContactMethod;
  source: string;
  propertyType: PropertyType;
  notes: string;
  serviceDetails: QuoteServiceDetails;
  riskProfile: QuoteRiskProfile;
  photoAttachments: ClientPhoto[];
  preferredWindows: PreferredWindow[];
};

const accessOptions: { value: AccessConcern; label: string }[] = [
  { value: "tight_side_yard", label: "Tight side yard" },
  { value: "locked_gate", label: "Locked gate" },
  { value: "long_hose_pull", label: "Long hose pull" },
  { value: "no_driveway", label: "No driveway" },
  { value: "no_spigot", label: "No spigot" },
  { value: "ladder_work", label: "Ladder work" },
  { value: "steep_property", label: "Steep property" },
  { value: "pool_equipment", label: "Pool equipment" },
  { value: "pets", label: "Pets" },
  { value: "fragile_surface", label: "Fragile surface" },
  { value: "gutter_guards", label: "Gutter guards" },
  { value: "heavy_furniture", label: "Heavy furniture" },
];

const windowOptions: { value: WindowDetail; label: string }[] = [
  { value: "exterior_only", label: "Exterior only" },
  { value: "inside_outside", label: "Inside + outside" },
  { value: "screens", label: "Screens" },
  { value: "tracks", label: "Tracks" },
  { value: "storm_windows", label: "Storms" },
  { value: "french_panes", label: "French panes" },
  { value: "hard_water", label: "Hard water" },
  { value: "ladder_windows", label: "High glass" },
];

const photoChecklistByService: Record<string, string[]> = {
  "house-wash": ["Front", "left/right sides", "worst green area"],
  "window-cleaning": ["Window banks", "screens/storms", "high or stained glass"],
  "roof-wash": ["Roof front/back", "heavy moss", "plants under roofline"],
  gutters: ["Gutter line", "highest section", "guards/downspouts"],
  "patio-wash": ["Whole patio", "furniture", "worst stains"],
  "fence-wash": ["Full fence run", "close-up buildup", "both sides if needed"],
  "paver-refresh": ["Full paver area", "joints", "sealer/weeds/stains"],
  "solar-panels": ["Panel layout", "roof access"],
  "permanent-lighting": ["Roofline", "corners/returns", "power/control spot"],
  painting: ["Each side/room", "repairs", "paint failure"],
};

function defaultLine(service: Service): QuoteServiceLine {
  const size = service.sizeOptions[1] ?? service.sizeOptions[0];
  return {
    serviceSlug: service.slug,
    jobSize: size.value,
    jobSizeLabel: size.label,
  };
}

type StepFieldErrors = Partial<
  Record<
    | "addressStreet"
    | "addressCity"
    | "addressZip"
    | "customerName"
    | "customerPhone"
    | "customerEmail",
    string
  >
>;

const ZIP_RE = /^\d{5}$/;
const PHONE_DIGITS_RE = /\d{10,}/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function QuoteForm({ services }: { services: Service[] }) {
  const firstService = services[0];
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<StepFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [form, setForm] = useState<FormState>({
    serviceSlug: firstService.slug,
    jobSize: firstService.sizeOptions[1].value,
    jobSizeLabel: firstService.sizeOptions[1].label,
    serviceLines: [defaultLine(firstService)],
    stories: 1,
    urgency: "this_week",
    addressStreet: "",
    addressCity: "",
    addressZip: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    preferredContactMethod: "text",
    source: "",
    propertyType: "single_family",
    notes: "",
    serviceDetails: {
      roofMossSeverity: "not_sure",
      roofPlantProtection: "not_sure",
      gutterGuards: "not_sure",
      downspoutConcern: false,
      fenceSides: "not_sure",
      paverCondition: "standard",
      screenCount: null,
      stormWindowCount: null,
      hardWaterPanes: null,
      patioFurnitureLevel: "not_sure",
      solarPanelPitch: "not_sure",
    },
    riskProfile: {
      surfaceCondition: "moderate",
      roofPitch: "standard",
      roofWalkable: "not_sure",
      waterAccess: "confirmed",
      access: [],
      windowDetails: firstService.slug === "window-cleaning" ? ["exterior_only"] : [],
    },
    photoAttachments: [],
    preferredWindows: [],
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("src") ?? params.get("utm_source") ?? "")
      .trim()
      .toLowerCase();
    if (!raw) return;
    const mapping: Record<string, string> = {
      nextdoor: "Nextdoor",
      google: "Google",
      referral: "Referral",
      repeat: "Repeat customer",
      truck: "Truck QR",
      sign: "Yard sign",
      yardsign: "Yard sign",
      yard_sign: "Yard sign",
    };
    const matched = mapping[raw];
    if (!matched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- run-once URL→source auto-tag; no cascading render concern
    setForm((current) => (current.source ? current : { ...current, source: matched }));
  }, []);

  useEffect(() => {
    return () => {
      for (const photo of form.photoAttachments) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
    // Cleanup on unmount only — object URLs created during the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSlugs = useMemo(
    () => new Set(form.serviceLines.map((line) => line.serviceSlug)),
    [form.serviceLines],
  );
  const serviceBySlug = useMemo(
    () => new Map(services.map((service) => [service.slug, service])),
    [services],
  );
  const photoChecklist = useMemo(
    () =>
      Array.from(
        new Set(
          form.serviceLines.flatMap(
            (line) => photoChecklistByService[line.serviceSlug] ?? [],
          ),
        ),
      ).slice(0, 8),
    [form.serviceLines],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateRisk(next: Partial<QuoteRiskProfile>) {
    setForm((current) => ({
      ...current,
      riskProfile: { ...current.riskProfile, ...next },
    }));
  }

  function updateServiceDetails(next: Partial<QuoteServiceDetails>) {
    setForm((current) => ({
      ...current,
      serviceDetails: { ...current.serviceDetails, ...next },
    }));
  }

  function toggleService(service: Service) {
    setForm((current) => {
      const exists = current.serviceLines.some(
        (line) => line.serviceSlug === service.slug,
      );
      const serviceLines =
        exists && current.serviceLines.length > 1
          ? current.serviceLines.filter((line) => line.serviceSlug !== service.slug)
          : exists
            ? current.serviceLines
            : [...current.serviceLines, defaultLine(service)];
      const primary = serviceLines[0];
      const slugs = new Set(serviceLines.map((line) => line.serviceSlug));
      const riskProfile = {
        ...current.riskProfile,
        windowDetails: slugs.has("window-cleaning")
          ? current.riskProfile.windowDetails
          : [],
        roofPitch: slugs.has("roof-wash")
          ? current.riskProfile.roofPitch
          : "standard" as QuoteRiskProfile["roofPitch"],
        roofWalkable: slugs.has("roof-wash")
          ? current.riskProfile.roofWalkable
          : "not_sure" as QuoteRiskProfile["roofWalkable"],
      };
      return {
        ...current,
        serviceLines,
        serviceSlug: primary.serviceSlug,
        jobSize: primary.jobSize,
        jobSizeLabel: primary.jobSizeLabel,
        riskProfile,
      };
    });
  }

  function updateServiceSize(slug: string, option: Service["sizeOptions"][number]) {
    setForm((current) => {
      const serviceLines = current.serviceLines.map((line) =>
        line.serviceSlug === slug
          ? { ...line, jobSize: option.value, jobSizeLabel: option.label }
          : line,
      );
      const primary = serviceLines[0];
      return {
        ...current,
        serviceLines,
        serviceSlug: primary.serviceSlug,
        jobSize: primary.jobSize,
        jobSizeLabel: primary.jobSizeLabel,
      };
    });
  }

  function toggleAccess(value: AccessConcern) {
    const exists = form.riskProfile.access.includes(value);
    updateRisk({
      access: exists
        ? form.riskProfile.access.filter((item) => item !== value)
        : [...form.riskProfile.access, value],
    });
  }

  function toggleWindowDetail(value: WindowDetail) {
    const exists = form.riskProfile.windowDetails.includes(value);
    updateRisk({
      windowDetails: exists
        ? form.riskProfile.windowDetails.filter((item) => item !== value)
        : [...form.riskProfile.windowDetails, value],
    });
  }

  async function handlePhotos(files: FileList | null) {
    setPhotoMessage("");
    if (!files) return;
    const incoming = Array.from(files);
    const remaining = Math.max(0, MAX_QUOTE_PHOTOS - form.photoAttachments.length);
    if (remaining === 0) {
      setPhotoMessage(
        `Photo limit reached (${MAX_QUOTE_PHOTOS}). Remove one to add another.`,
      );
      return;
    }
    const overflow = incoming.length - remaining;
    const nextFiles = incoming.slice(0, remaining);
    setPhotoMessage(`Processing ${nextFiles.length} photo${nextFiles.length === 1 ? "" : "s"}…`);

    const results = await Promise.all(nextFiles.map(readPhoto));
    const photos = results
      .filter((result): result is Extract<PhotoReadResult, { kind: "ok" }> => result.kind === "ok")
      .map((result) => result.photo);
    const failures = results.filter(
      (result): result is Extract<PhotoReadResult, { kind: "error" }> => result.kind === "error",
    );

    setForm((current) => ({
      ...current,
      photoAttachments: [...current.photoAttachments, ...photos].slice(
        0,
        MAX_QUOTE_PHOTOS,
      ),
    }));

    if (failures.length === 0 && overflow <= 0) {
      setPhotoMessage(
        photos.length > 0
          ? `Added ${photos.length} photo${photos.length === 1 ? "" : "s"} (auto-compressed).`
          : "",
      );
      return;
    }

    const overflowNote =
      overflow > 0
        ? `Photo limit is ${MAX_QUOTE_PHOTOS} - ${overflow} extra skipped.`
        : "";
    const failureNote = failures
      .map((failure) => `${failure.name}: ${failure.reason}`)
      .join(" · ");
    setPhotoMessage(
      [overflowNote, failureNote].filter(Boolean).join(" "),
    );
  }

  function removePhoto(id: string) {
    setForm((current) => {
      const removed = current.photoAttachments.find((photo) => photo.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return {
        ...current,
        photoAttachments: current.photoAttachments.filter((photo) => photo.id !== id),
      };
    });
  }

  function validateStep(target: number): StepFieldErrors {
    const errs: StepFieldErrors = {};
    if (target >= 2) {
      if (!form.addressStreet.trim()) {
        errs.addressStreet = "Street address is required.";
      }
      if (!form.addressCity.trim()) {
        errs.addressCity = "Town is required.";
      }
      if (!ZIP_RE.test(form.addressZip.trim())) {
        errs.addressZip = "5-digit ZIP, please.";
      }
    }
    if (target >= 3) {
      if (!form.customerName.trim()) {
        errs.customerName = "Your name lets Dante address the quote to you.";
      }
      const phoneDigits = form.customerPhone.replace(/\D/g, "");
      if (!PHONE_DIGITS_RE.test(phoneDigits)) {
        errs.customerPhone = "Best phone number for a text-back.";
      }
      if (form.customerEmail && !EMAIL_RE.test(form.customerEmail.trim())) {
        errs.customerEmail = "Email format looks off.";
      }
      if (
        form.preferredContactMethod === "email" &&
        !EMAIL_RE.test(form.customerEmail.trim())
      ) {
        errs.customerEmail = "Email is required if you prefer email.";
      }
    }
    return errs;
  }

  function attemptAdvance() {
    const next = step + 1;
    // Validate the step we're leaving (cumulative, scoped to next - 1)
    const errs = validateStep(next - 1);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Fix the highlighted fields to continue.");
      return;
    }
    setFieldErrors({});
    setError("");
    setStep(Math.min(3, next));
  }

  function goBack() {
    setError("");
    setFieldErrors({});
    setStep((current) => Math.max(1, current - 1));
  }

  function fieldErrorFor(name: keyof StepFieldErrors) {
    return fieldErrors[name];
  }

  function inputClassName(name: keyof StepFieldErrors) {
    const base =
      "mt-2 h-12 w-full rounded-md border bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4";
    return fieldErrors[name]
      ? `${base} border-[#d96b67] ring-[#d96b67]/20`
      : `${base} border-[#cbc7bb]`;
  }

  async function submit() {
    const errs = validateStep(3);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Fix the highlighted fields to continue.");
      return;
    }
    setFieldErrors({});
    setError("");
    setLoading(true);
    try {
      const primary = form.serviceLines[0];
      const photoAttachments = await clientPhotosToAttachments(
        form.photoAttachments,
      );
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          photoAttachments,
          serviceSlug: primary.serviceSlug,
          jobSize: primary.jobSize,
          jobSizeLabel: primary.jobSizeLabel,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        const serverErrors: StepFieldErrors = {};
        const apiFieldErrors = json?.details?.fieldErrors as
          | Record<string, string[] | undefined>
          | undefined;
        if (apiFieldErrors) {
          for (const key of [
            "addressStreet",
            "addressCity",
            "addressZip",
            "customerName",
            "customerPhone",
            "customerEmail",
          ] as const) {
            const msg = apiFieldErrors[key]?.[0];
            if (msg) serverErrors[key] = msg;
          }
        }
        if (Object.keys(serverErrors).length > 0) {
          setFieldErrors(serverErrors);
        }
        throw new Error(json.error ?? "Could not submit quote");
      }
      setResult(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit quote");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return <ResultPanel result={result} />;
  }

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white shadow-sm">
      <div className="border-b border-[#e7e3d8] px-5 py-4">
        <div className="flex items-center justify-between text-sm font-medium text-[#62685f]">
          <span>Step {step} of 3</span>
          <span>{form.photoAttachments.length} photos</span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                What should we quote?
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#62685f]">
                Pick everything you want handled. Bundles are priced for saved
                setup time, not guesswork.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((item) => {
                const selected = selectedSlugs.has(item.slug);
                return (
                  <button
                    key={item.slug}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleService(item)}
                    className={`min-h-28 rounded-md border p-4 text-left transition ${
                      selected
                        ? "border-[#1d211c] bg-[#f3f7df]"
                        : "border-[#dedbd1] bg-white hover:border-[#9ea394]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {item.name}
                      {selected ? <Check size={16} /> : null}
                    </span>
                    {item.quoteMode === "survey_required" ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#fff0d6] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#805a00]">
                        <ClipboardCheck size={11} />
                        Survey first
                      </span>
                    ) : item.quoteMode === "review_required" ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#edf1ff] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#334477]">
                        <Eye size={11} />
                        Owner review
                      </span>
                    ) : null}
                    <span className="mt-2 block text-xs leading-5 text-[#62685f]">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {form.serviceLines.map((line) => {
                const service = serviceBySlug.get(line.serviceSlug);
                if (!service) return null;
                return (
                  <fieldset
                    key={line.serviceSlug}
                    className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4"
                  >
                    <legend className="px-1 text-sm font-semibold">
                      {service.sizeLabel} for {service.shortName}
                    </legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {service.sizeOptions.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={line.jobSize === option.value}
                          onClick={() => updateServiceSize(service.slug, option)}
                          className={`rounded-md border p-3 text-left transition ${
                            line.jobSize === option.value
                              ? "border-[#1d211c] bg-[#1d211c] text-white"
                              : "border-[#dedbd1] bg-white hover:border-[#9ea394]"
                          }`}
                        >
                          <span className="block text-sm font-semibold">
                            {option.label}
                          </span>
                          <span
                            className={`mt-1 block text-xs leading-5 ${
                              line.jobSize === option.value
                                ? "text-white/80"
                                : "text-[#62685f]"
                            }`}
                          >
                            {option.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Where and when?
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#62685f]">
                Address gives you an estimated quote. Add 2-4 photos if you
                want Dante to turn it into an actual quote faster. Skipping
                photos is fine.
              </p>
            </div>

            <div>
              <label htmlFor={fieldId("street")} className="block text-sm font-semibold">
                Street
              </label>
              <input
                id={fieldId("street")}
                name="addressStreet"
                value={form.addressStreet}
                onChange={(event) => update("addressStreet", event.target.value)}
                className={inputClassName("addressStreet")}
                placeholder="123 Main St"
                autoComplete="street-address"
                aria-invalid={!!fieldErrorFor("addressStreet")}
                aria-describedby={
                  fieldErrorFor("addressStreet") ? `${fieldId("street")}-err` : undefined
                }
              />
              {fieldErrorFor("addressStreet") ? (
                <p
                  id={`${fieldId("street")}-err`}
                  className="mt-1 text-xs font-medium text-[#b42318]"
                >
                  {fieldErrorFor("addressStreet")}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div>
                <label htmlFor={fieldId("town")} className="block text-sm font-semibold">
                  Town
                </label>
                <input
                  id={fieldId("town")}
                  name="addressCity"
                  value={form.addressCity}
                  onChange={(event) => update("addressCity", event.target.value)}
                  className={inputClassName("addressCity")}
                  placeholder="Huntington"
                  autoComplete="address-level2"
                  aria-invalid={!!fieldErrorFor("addressCity")}
                  aria-describedby={
                    fieldErrorFor("addressCity") ? `${fieldId("town")}-err` : undefined
                  }
                />
                {fieldErrorFor("addressCity") ? (
                  <p
                    id={`${fieldId("town")}-err`}
                    className="mt-1 text-xs font-medium text-[#b42318]"
                  >
                    {fieldErrorFor("addressCity")}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor={fieldId("zip")} className="block text-sm font-semibold">
                  ZIP
                </label>
                <input
                  id={fieldId("zip")}
                  name="addressZip"
                  value={form.addressZip}
                  onChange={(event) => update("addressZip", event.target.value)}
                  inputMode="numeric"
                  maxLength={5}
                  className={inputClassName("addressZip")}
                  placeholder="11743"
                  autoComplete="postal-code"
                  aria-invalid={!!fieldErrorFor("addressZip")}
                  aria-describedby={
                    fieldErrorFor("addressZip") ? `${fieldId("zip")}-err` : undefined
                  }
                />
                {fieldErrorFor("addressZip") ? (
                  <p
                    id={`${fieldId("zip")}-err`}
                    className="mt-1 text-xs font-medium text-[#b42318]"
                  >
                    {fieldErrorFor("addressZip")}
                  </p>
                ) : null}
              </div>
            </div>

            <label className="block text-sm font-semibold">
              Property type
              <select
                value={form.propertyType}
                onChange={(event) =>
                  update("propertyType", event.target.value as PropertyType)
                }
                className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
              >
                {Object.entries(propertyTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold">
              When would you want this done?
              <select
                value={form.urgency}
                onChange={(event) => update("urgency", event.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
              >
                {urgencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-dashed border-[#b8b3a4] bg-[#fbfaf7] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Camera size={16} />
                    Photos (optional - actual quote faster)
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#62685f]">
                    Upload the shots below if you want an actual quote sooner.
                    Skip this if you prefer an estimated quote and quick
                    follow-up.
                  </p>
                </div>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e]">
                  <Upload size={15} />
                  Add photos
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    aria-describedby={
                      photoChecklist.length > 0 ? fieldId("photo-checklist") : undefined
                    }
                    onChange={(event) => handlePhotos(event.target.files)}
                  />
                </label>
              </div>
              {photoChecklist.length > 0 ? (
                <div
                  id={fieldId("photo-checklist")}
                  className="mt-4 grid gap-2 sm:grid-cols-2"
                >
                  {photoChecklist.map((item) => (
                    <div
                      key={item}
                      className="rounded-md border border-[#e4e0d5] bg-white px-3 py-2 text-xs font-semibold text-[#62685f]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
              {photoMessage ? (
                <p
                  role={photoMessage.startsWith("Added") || photoMessage.startsWith("Processing") ? undefined : "alert"}
                  className={`mt-3 rounded-md px-3 py-2 text-xs font-semibold ${
                    photoMessage.startsWith("Added")
                      ? "bg-[#eef6e3] text-[#3a6c2c]"
                      : photoMessage.startsWith("Processing")
                        ? "bg-[#f1efe6] text-[#62685f]"
                        : "bg-[#fff5f5] text-[#b42318]"
                  }`}
                >
                  {photoMessage}
                </p>
              ) : null}
              {form.photoAttachments.length > 0 ? (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {form.photoAttachments.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-md border border-[#d8d4c7] bg-white"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[#1d211c] shadow-sm"
                        aria-label={`Remove ${photo.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <details className="group rounded-md border border-[#dedbd1] bg-white">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-[#1d211c] [&::-webkit-details-marker]:hidden">
                <span>Add detail (optional — tightens the price)</span>
                <ChevronDown
                  size={16}
                  className="text-[#62685f] transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="space-y-4 border-t border-[#ece8dd] px-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    Stories
                    <select
                      value={form.stories}
                      onChange={(event) => update("stories", Number(event.target.value))}
                      className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
                    >
                      <option value={1}>1 story</option>
                      <option value={2}>2 stories</option>
                      <option value={3}>3+ stories</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    How dirty does it look?
                    <select
                      value={form.riskProfile.surfaceCondition}
                      onChange={(event) =>
                        updateRisk({
                          surfaceCondition: event.target
                            .value as QuoteRiskProfile["surfaceCondition"],
                        })
                      }
                      className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
                    >
                      <option value="light">Looks pretty clean</option>
                      <option value="moderate">Normal buildup</option>
                      <option value="heavy">Lots of green / dirt</option>
                      <option value="oxidation">Faded or chalky siding</option>
                      <option value="restoration">Heavy stains / restoration</option>
                    </select>
                  </label>
                  {selectedSlugs.has("roof-wash") ? (
                    <>
                      <label className="text-sm font-semibold">
                        Roof pitch
                        <select
                          value={form.riskProfile.roofPitch}
                          onChange={(event) =>
                            updateRisk({
                              roofPitch: event.target
                                .value as QuoteRiskProfile["roofPitch"],
                            })
                          }
                          className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
                        >
                          <option value="not_sure">Not sure</option>
                          <option value="low">Low slope</option>
                          <option value="standard">Standard</option>
                          <option value="steep">Steep</option>
                          <option value="very_steep">Very steep</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold">
                        Roof access
                        <select
                          value={form.riskProfile.roofWalkable}
                          onChange={(event) =>
                            updateRisk({
                              roofWalkable: event.target
                                .value as QuoteRiskProfile["roofWalkable"],
                            })
                          }
                          className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
                        >
                          <option value="not_sure">Not sure</option>
                          <option value="yes">Pretty flat / walkable</option>
                          <option value="no">Steep or not walkable</option>
                        </select>
                      </label>
                    </>
                  ) : null}
                  <label className="text-sm font-semibold">
                    Outdoor faucet
                    <select
                      value={form.riskProfile.waterAccess}
                      onChange={(event) =>
                        updateRisk({
                          waterAccess: event.target
                            .value as QuoteRiskProfile["waterAccess"],
                        })
                      }
                      className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
                    >
                      <option value="confirmed">Yes, available</option>
                      <option value="not_sure">Not sure</option>
                      <option value="none">No outdoor faucet</option>
                    </select>
                  </label>
                </div>

                <ToggleGroup
                  title="Anything tricky about getting around the house?"
                  options={accessOptions}
                  selected={form.riskProfile.access}
                  onToggle={toggleAccess}
                />

                {selectedSlugs.has("window-cleaning") ? (
                  <div className="space-y-3">
                    <ToggleGroup
                      title="Window detail"
                      options={windowOptions}
                      selected={form.riskProfile.windowDetails}
                      onToggle={toggleWindowDetail}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NumberDetail
                        label="Screen count"
                        value={form.serviceDetails.screenCount}
                        onChange={(value) => updateServiceDetails({ screenCount: value })}
                      />
                      <NumberDetail
                        label="Storm window count"
                        value={form.serviceDetails.stormWindowCount}
                        onChange={(value) =>
                          updateServiceDetails({ stormWindowCount: value })
                        }
                      />
                      <NumberDetail
                        label="Hard-water pane count"
                        value={form.serviceDetails.hardWaterPanes}
                        onChange={(value) =>
                          updateServiceDetails({ hardWaterPanes: value })
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {selectedSlugs.has("roof-wash") ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectDetail
                      label="Moss severity"
                      value={form.serviceDetails.roofMossSeverity}
                      options={[
                        ["not_sure", "Not sure"],
                        ["none", "None"],
                        ["light", "Light moss"],
                        ["heavy", "Heavy moss"],
                      ]}
                      onChange={(value) =>
                        updateServiceDetails({
                          roofMossSeverity:
                            value as QuoteServiceDetails["roofMossSeverity"],
                        })
                      }
                    />
                    <SelectDetail
                      label="Landscaping protection"
                      value={form.serviceDetails.roofPlantProtection}
                      options={[
                        ["not_sure", "Not sure"],
                        ["standard", "Standard"],
                        ["heavy", "Lots of plants"],
                      ]}
                      onChange={(value) =>
                        updateServiceDetails({
                          roofPlantProtection:
                            value as QuoteServiceDetails["roofPlantProtection"],
                        })
                      }
                    />
                  </div>
                ) : null}

                {selectedSlugs.has("gutters") ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectDetail
                      label="Gutter guards"
                      value={form.serviceDetails.gutterGuards}
                      options={[
                        ["not_sure", "Not sure"],
                        ["none", "No guards"],
                        ["some", "Some guards"],
                        ["all", "All guarded"],
                      ]}
                      onChange={(value) =>
                        updateServiceDetails({
                          gutterGuards:
                            value as QuoteServiceDetails["gutterGuards"],
                        })
                      }
                    />
                    <label className="flex min-h-12 items-center gap-3 rounded-md border border-[#d8d4c7] bg-[#fbfaf7] px-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={form.serviceDetails.downspoutConcern}
                        onChange={(event) =>
                          updateServiceDetails({
                            downspoutConcern: event.target.checked,
                          })
                        }
                        className="h-4 w-4"
                      />
                      Downspouts may be clogged
                    </label>
                  </div>
                ) : null}

                {selectedSlugs.has("fence-wash") ? (
                  <SelectDetail
                    label="Fence sides"
                    value={form.serviceDetails.fenceSides}
                    options={[
                      ["not_sure", "Not sure"],
                      ["one", "One side"],
                      ["both", "Both sides"],
                    ]}
                    onChange={(value) =>
                      updateServiceDetails({
                        fenceSides: value as QuoteServiceDetails["fenceSides"],
                      })
                    }
                  />
                ) : null}

                {selectedSlugs.has("paver-refresh") ? (
                  <SelectDetail
                    label="Paver condition"
                    value={form.serviceDetails.paverCondition}
                    options={[
                      ["standard", "Standard cleaning"],
                      ["weeds", "Weeds in joints"],
                      ["failed_sealer", "Failed sealer"],
                      ["sanding_sealing", "Interested in sand/seal"],
                      ["not_sure", "Not sure"],
                    ]}
                    onChange={(value) =>
                      updateServiceDetails({
                        paverCondition:
                          value as QuoteServiceDetails["paverCondition"],
                      })
                    }
                  />
                ) : null}

                {selectedSlugs.has("patio-wash") ? (
                  <SelectDetail
                    label="Furniture / obstacles"
                    value={form.serviceDetails.patioFurnitureLevel}
                    options={[
                      ["not_sure", "Not sure"],
                      ["none", "Clear patio"],
                      ["light", "A few pieces"],
                      ["heavy", "Heavy furniture"],
                    ]}
                    onChange={(value) =>
                      updateServiceDetails({
                        patioFurnitureLevel:
                          value as QuoteServiceDetails["patioFurnitureLevel"],
                      })
                    }
                  />
                ) : null}

                {selectedSlugs.has("solar-panels") ? (
                  <SelectDetail
                    label="Solar roof pitch"
                    value={form.serviceDetails.solarPanelPitch}
                    options={[
                      ["not_sure", "Not sure"],
                      ["low", "Low slope"],
                      ["standard", "Standard"],
                      ["steep", "Steep"],
                    ]}
                    onChange={(value) =>
                      updateServiceDetails({
                        solarPanelPitch:
                          value as QuoteServiceDetails["solarPanelPitch"],
                      })
                    }
                  />
                ) : null}
              </div>
            </details>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Almost done
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#62685f]">
                Just your name and the best number to reach you. Dante texts the
                quote and any quick scope questions.
              </p>
            </div>
            <div>
              <label htmlFor={fieldId("name")} className="block text-sm font-semibold">
                Name
              </label>
              <input
                id={fieldId("name")}
                name="customerName"
                value={form.customerName}
                onChange={(event) => update("customerName", event.target.value)}
                className={inputClassName("customerName")}
                autoComplete="name"
                aria-invalid={!!fieldErrorFor("customerName")}
                aria-describedby={
                  fieldErrorFor("customerName") ? `${fieldId("name")}-err` : undefined
                }
              />
              {fieldErrorFor("customerName") ? (
                <p
                  id={`${fieldId("name")}-err`}
                  className="mt-1 text-xs font-medium text-[#b42318]"
                >
                  {fieldErrorFor("customerName")}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor={fieldId("phone")} className="block text-sm font-semibold">
                Phone
              </label>
              <input
                id={fieldId("phone")}
                name="customerPhone"
                value={form.customerPhone}
                onChange={(event) => update("customerPhone", event.target.value)}
                className={inputClassName("customerPhone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(631) 555-0123"
                aria-invalid={!!fieldErrorFor("customerPhone")}
                aria-describedby={
                  fieldErrorFor("customerPhone") ? `${fieldId("phone")}-err` : undefined
                }
              />
              {fieldErrorFor("customerPhone") ? (
                <p
                  id={`${fieldId("phone")}-err`}
                  className="mt-1 text-xs font-medium text-[#b42318]"
                >
                  {fieldErrorFor("customerPhone")}
                </p>
              ) : null}
            </div>
            <label className="block text-sm font-semibold">
              Best way to reach you
              <select
                value={form.preferredContactMethod}
                onChange={(event) =>
                  update(
                    "preferredContactMethod",
                    event.target.value as PreferredContactMethod,
                  )
                }
                className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
              >
                {Object.entries(preferredContactLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label htmlFor={fieldId("email")} className="block text-sm font-semibold">
                Email{" "}
                <span className="font-normal text-[#62685f]">
                  (optional — for an emailed copy of the quote)
                </span>
              </label>
              <input
                id={fieldId("email")}
                name="customerEmail"
                value={form.customerEmail}
                onChange={(event) => update("customerEmail", event.target.value)}
                className={inputClassName("customerEmail")}
                type="email"
                autoComplete="email"
                aria-invalid={!!fieldErrorFor("customerEmail")}
                aria-describedby={
                  fieldErrorFor("customerEmail") ? `${fieldId("email")}-err` : undefined
                }
              />
              {fieldErrorFor("customerEmail") ? (
                <p
                  id={`${fieldId("email")}-err`}
                  className="mt-1 text-xs font-medium text-[#b42318]"
                >
                  {fieldErrorFor("customerEmail")}
                </p>
              ) : null}
            </div>
            <label className="block text-sm font-semibold" htmlFor={fieldId("notes")}>
              Job notes{" "}
              <span className="font-normal text-[#62685f]">
                (anything Dante should know)
              </span>
              <textarea
                id={fieldId("notes")}
                name="notes"
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                className="mt-2 min-h-24 w-full rounded-md border border-[#cbc7bb] bg-white px-3 py-2 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
                placeholder="Heavy green side, locked gate, wants windows too, flexible after next week..."
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-[#f5c2c0] bg-[#fff5f5] px-3 py-2 text-sm font-medium text-[#b42318]"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={step === 1 || loading}
            onClick={goBack}
            className="inline-flex h-12 items-center gap-2 rounded-md border border-[#cbc7bb] bg-white px-4 text-sm font-semibold text-[#1d211c] transition hover:border-[#1d211c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={attemptAdvance}
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[#1d211c] px-5 text-sm font-semibold text-white transition hover:bg-[#30372e]"
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[#1d211c] px-5 text-sm font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              Get quote options
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
