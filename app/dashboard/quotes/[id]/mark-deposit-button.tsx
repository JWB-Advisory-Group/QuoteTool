"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

export function MarkDepositButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function markPaid() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/quotes/${quoteId}/deposit`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Could not mark deposit paid");
      }
      setMessage("Deposit marked paid.");
      router.refresh();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Could not mark deposit paid",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={markPaid}
        disabled={loading}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1d211c] px-3 text-sm font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Mark deposit paid
      </button>
      {message ? (
        <p className="mt-2 text-xs font-medium text-[#62685f]">{message}</p>
      ) : null}
    </div>
  );
}
