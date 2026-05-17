import { getNotificationHealth } from "@/lib/server/notifications";
import { getStorageHealth } from "@/lib/server/store";

export const runtime = "nodejs";

export async function GET() {
  const storage = getStorageHealth();
  const notifications = getNotificationHealth();

  return Response.json({
    ok: true,
    storage,
    notifications: {
      ready: notifications.ready,
      appUrlReady: notifications.appUrlReady,
      missing: notifications.missing,
    },
  });
}
