"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { OwnerMessageTemplate } from "@/lib/message-templates";

export function MessageTemplatesPanel({
  templates,
}: {
  templates: OwnerMessageTemplate[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(template: OwnerMessageTemplate) {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopiedId(template.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Text templates</h2>
      <div className="mt-4 space-y-3">
        {templates.map((template) => {
          const copied = copiedId === template.id;
          return (
            <div
              key={template.id}
              className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{template.label}</div>
                  <div className="mt-1 text-xs leading-5 text-[#62685f]">
                    {template.intent}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copy(template)}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-[#1d211c] px-3 text-xs font-semibold text-white transition hover:bg-[#30372e]"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#4b5148]">
                {template.body}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
