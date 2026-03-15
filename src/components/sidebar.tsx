"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboardIcon,
  FilmIcon,
  BuildingIcon,
  LogOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
} from "lucide-react";

import { signOutAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { PushNotificationsButton } from "@/components/push-notifications-button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboardIcon,
  "/requests/new": FilmIcon,
  "/admin/dashboard": LayoutDashboardIcon,
  "/admin/companies": BuildingIcon,
  "/supervisor/dashboard": LayoutDashboardIcon,
  "/supervisor/operators": UsersIcon,
};

interface SidebarItem {
  href: string;
  label: string;
}

interface DashboardSidebarProps {
  title: string;
  subtitle: string;
  items: SidebarItem[];
  pathname: string;
}

export function DashboardSidebar({
  title,
  subtitle,
  items,
  pathname,
}: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex items-center pt-6 pb-4",
          isCollapsed ? "justify-center px-2" : "px-5",
        )}
      >
        {isCollapsed ? (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            DE
          </div>
        ) : (
          <div className="overflow-hidden">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Doctor Engagement
            </p>
            <h1 className="mt-1 text-base font-semibold leading-tight whitespace-nowrap">
              {title}
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {subtitle}
            </p>
          </div>
        )}
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-2 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = ICON_MAP[item.href] ?? LayoutDashboardIcon;

          if (isCollapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    size="icon"
                    className={cn(
                      "size-9 w-full",
                      active &&
                        "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                    asChild
                  >
                    <Link href={item.href}>
                      <Icon className="size-4" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-4">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Button
              key={item.href}
              variant={active ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "w-full justify-start gap-3",
                active &&
                  "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
              )}
              asChild
            >
              <Link href={item.href}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      <Separator />

      <div className="p-2">
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <PushNotificationsButton compact />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Enable Notifications</TooltipContent>
          </Tooltip>
        ) : (
          <PushNotificationsButton />
        )}
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <form action={signOutAction}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 w-full text-muted-foreground"
                >
                  <LogOutIcon className="size-4" />
                  <span className="sr-only">Sign Out</span>
                </Button>
              </form>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        ) : (
          <form action={signOutAction}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-muted-foreground"
            >
              <LogOutIcon className="size-4" />
              Sign Out
            </Button>
          </form>
        )}
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-6 z-20 size-6 rounded-full border bg-background shadow-sm hover:bg-accent"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        {isCollapsed ? (
          <ChevronRightIcon className="size-3" />
        ) : (
          <ChevronLeftIcon className="size-3" />
        )}
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    </aside>
  );
}
