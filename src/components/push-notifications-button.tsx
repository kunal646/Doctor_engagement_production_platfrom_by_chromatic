"use client";

import { useEffect, useMemo, useState } from "react";
import { BellIcon, BellOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type NotificationState =
  | "checking"
  | "unsupported"
  | "ready"
  | "subscribed"
  | "denied"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function PushNotificationsButton({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<NotificationState>("checking");
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";

  useEffect(() => {
    let mounted = true;

    async function loadState() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (mounted) {
          setState("unsupported");
        }
        return;
      }

      if (!publicKey) {
        if (mounted) {
          setState("error");
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (mounted) {
          setState("denied");
        }
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (!mounted) {
        return;
      }
      setState(subscription ? "subscribed" : "ready");
    }

    loadState().catch(() => {
      if (mounted) {
        setState("error");
      }
    });

    return () => {
      mounted = false;
    };
  }, [publicKey]);

  const label = useMemo(() => {
    switch (state) {
      case "subscribed":
        return "Notifications On";
      case "denied":
        return "Notifications Blocked";
      case "unsupported":
        return "Notifications Unsupported";
      case "error":
        return "Notifications Unavailable";
      case "checking":
        return "Checking Notifications";
      default:
        return "Enable Notifications";
    }
  }, [state]);

  async function handleToggle() {
    if (state === "unsupported" || state === "checking") {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existingSubscription.endpoint }),
        });
        await existingSubscription.unsubscribe();
        setState("ready");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error("Could not save push subscription.");
      }

      setState("subscribed");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Failed to update notifications.");
      setState("error");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "sm"}
      className={compact ? "size-9 w-full text-muted-foreground" : "w-full justify-start gap-3 text-muted-foreground"}
      onClick={handleToggle}
      title={label}
    >
      {state === "subscribed" ? (
        <BellIcon className="size-4" />
      ) : (
        <BellOffIcon className="size-4" />
      )}
      {!compact ? label : <span className="sr-only">{label}</span>}
    </Button>
  );
}
