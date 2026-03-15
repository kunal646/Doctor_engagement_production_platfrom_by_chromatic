import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole, UserPushSubscriptionRow } from "@/lib/types";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  urlsByRole?: Partial<Record<UserRole, string>>;
  tag: string;
}

interface PushTargetOptions {
  companyId?: string | null;
  userIds?: string[];
  roles?: UserRole[];
}

function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY &&
      process.env.WEB_PUSH_PRIVATE_KEY &&
      process.env.WEB_PUSH_CONTACT_EMAIL,
  );
}

function configureWebPush() {
  if (!isPushConfigured()) {
    return false;
  }

  webpush.setVapidDetails(
    `mailto:${process.env.WEB_PUSH_CONTACT_EMAIL!}`,
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!,
    process.env.WEB_PUSH_PRIVATE_KEY!,
  );

  return true;
}

async function getTargetUserIds({
  companyId,
  userIds,
  roles,
}: PushTargetOptions) {
  const adminClient = createAdminClient();
  const targetIds = new Set(userIds ?? []);

  if (roles?.length) {
    let query = adminClient
      .from("profiles")
      .select("id,role,company_id")
      .in("role", roles);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data: profiles } = await query.returns<
      { id: string; role: UserRole; company_id: string | null }[]
    >();

    for (const profile of profiles ?? []) {
      targetIds.add(profile.id);
    }
  }

  return [...targetIds];
}

async function removeSubscriptionByEndpoint(endpoint: string) {
  const adminClient = createAdminClient();
  await adminClient.from("user_push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendPushNotifications(
  targets: PushTargetOptions,
  payload: PushPayload,
) {
  if (!configureWebPush()) {
    return;
  }

  const userIds = await getTargetUserIds(targets);
  if (userIds.length === 0) {
    return;
  }

  const adminClient = createAdminClient();
  const { data: subscriptions } = await adminClient
    .from("user_push_subscriptions")
    .select("*")
    .in("user_id", userIds)
    .returns<UserPushSubscriptionRow[]>();
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id,role")
    .in("id", userIds)
    .returns<{ id: string; role: UserRole }[]>();
  const roleByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile.role]));

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        const role = roleByUserId.get(subscription.user_id);
        const url =
          (role ? payload.urlsByRole?.[role] : undefined) ??
          payload.url ??
          "/";
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expiration_time,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url,
            tag: payload.tag,
          }),
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscriptionByEndpoint(subscription.endpoint);
          return;
        }
        console.error("Push notification failed:", error);
      }
    }),
  );
}

export function requestUrlForRole(role: UserRole, requestId: string) {
  if (role === "admin") {
    return `/admin/requests/${requestId}`;
  }
  if (role === "supervisor") {
    return `/supervisor/requests/${requestId}`;
  }
  return `/requests/${requestId}`;
}
