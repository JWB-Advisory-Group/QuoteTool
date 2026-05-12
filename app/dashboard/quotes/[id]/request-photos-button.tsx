"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";

export function RequestPhotosButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function send() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/quotes/${quoteId}/request-photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: "both" }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not request photos");
      setMessage("Photo request sent to the customer.");
      router.refresh();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "Could not request photos",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3">
      <button
        type="button"
        onClick={send}
        disabled={loading}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
        Request photos from customer
      </button>
      {message ? (
        <p className="mt-2 text-xs font-medium text-[#62685f]">{message}</p>
      ) : null}
    </div>
  );
}
