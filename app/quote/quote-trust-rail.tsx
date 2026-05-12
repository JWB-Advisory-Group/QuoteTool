import { Home, MapPin, ShieldCheck } from "lucide-react";

const proofPoints = [
  "Local Huntington / Suffolk exterior cleaning",
  "Insured, organized, photo-confirmed quoting",
  "Soft wash methods for siding and roof work",
];

export function QuoteTrustRail() {
  return (
    <div className="mt-6 grid gap-3">
      {proofPoints.map((point, index) => {
        const Icon = index === 0 ? MapPin : index === 1 ? ShieldCheck : Home;
        const accent =
          index === 0
            ? "bg-[#e8eddc] text-[#3d5717]"
            : index === 1
              ? "bg-[#d9e4f5] text-[#2a47a5]"
              : "bg-[#f0e3d3] text-[#7a5400]";
        return (
          <div
            key={point}
            className="flex items-start gap-3 rounded-md border border-[#dedbd1] bg-white/75 p-3"
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${accent}`}
            >
              <Icon size={15} />
            </span>
            <span className="text-sm leading-6 text-[#4b5148]">{point}</span>
          </div>
        );
      })}
    </div>
  );
}
