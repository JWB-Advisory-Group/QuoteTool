import type { FollowUpTask, Quote } from "@/lib/types";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addBusinessDaysFrom(base: string | null, days: number) {
  const date = base ? new Date(base) : new Date();
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return isoDate(date);
}

export function followUpTasksForQuote(quote: Quote): FollowUpTask[] {
  const sentTaskIds = new Set(quote.followUps.map((item) => item.taskId));
  const baseTasks =
    quote.status === "pending" || quote.status === "contacted"
      ? quote.estimate.followUpPlan
      : tasksForActiveQuote(quote);

  return baseTasks.filter((task) => !sentTaskIds.has(task.id));
}

function tasksForActiveQuote(quote: Quote): FollowUpTask[] {
  if (quote.status === "sent") {
    return [
      {
        id: "quote_follow_up_24h",
        label: "24-hour follow-up",
        dueDate: addBusinessDaysFrom(quote.sentAt, 1),
        channel: quote.estimate.leadQuality === "good" ? "call" : "sms",
        priority: "today",
        message: `Wanted to make sure you saw the ${quote.estimate.packageOptions.find((pkg) => pkg.id === "best_value")?.name ?? "quote"} options. We can hold the best route-fit window if the scope looks good.`,
        ownerNote: "Fast second touch protects the close before competitors answer.",
      },
      {
        id: "quote_follow_up_72h",
        label: "72-hour close/lost touch",
        dueDate: addBusinessDaysFrom(quote.sentAt, 3),
        channel: "sms",
        priority: "soon",
        message: "Last check before we release the tentative route window. Happy to adjust the scope if you want a smaller or bigger package.",
        ownerNote: "Recover the job or mark lost/no-response.",
      },
    ];
  }

  if (quote.status === "awaiting_deposit") {
    return [
      {
        id: "deposit_follow_up",
        label: "Deposit hold follow-up",
        dueDate: addBusinessDaysFrom(quote.approval?.approvedAt ?? quote.updatedAt, 1),
        channel: "sms",
        priority: "today",
        message: "Quick reminder on the deposit hold so we can lock the booking window. Reply here and we will confirm the next step.",
        ownerNote: "Do not schedule the crew until the manual deposit is confirmed.",
      },
    ];
  }

  if (quote.status === "approved" || quote.status === "scheduled") {
    return [
      {
        id: "booking_confirmation",
        label: "Confirm booking details",
        dueDate: addBusinessDaysFrom(quote.approval?.approvedAt ?? quote.updatedAt, 1),
        channel: "sms",
        priority: "today",
        message: "We are confirming the route window. Please make sure water access, gates, and parking are ready.",
        ownerNote: "Cuts day-of friction before the truck rolls.",
      },
    ];
  }

  return [];
}

export function isTaskDue(task: FollowUpTask, today = isoDate(new Date())) {
  return task.dueDate <= today;
}
