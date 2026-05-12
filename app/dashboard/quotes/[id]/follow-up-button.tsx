"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import type { FollowUpTask } from "@/lib/types";

export function FollowUpButton({
  quoteId,
  task,
}: {
  quoteId: string;
  task: FollowUpTask;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runFollowUp() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/quotes/${quoteId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          channel: task.channel,
          message: task.message,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Could not record follow-up");
      }
      setMessage(task.channel === "call" ? "Call logged." : "Follow-up sent.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not record follow-up",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={runFollowUp}
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1d211c] px-3 text-sm font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {task.channel === "call" ? "Log call" : "Send"}
      </button>
      {message ? (
        <p className="mt-2 text-xs font-medium text-[#62685f]">{message}</p>
      ) : null}
    </div>
  );
}
