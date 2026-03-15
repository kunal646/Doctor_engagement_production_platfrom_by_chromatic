"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  MenuIcon,
  LayoutDashboardIcon,
  FilmIcon,
  BuildingIcon,
  LogOutIcon,
  UsersIcon,
} from "lucide-react";

import { DashboardSidebar } from "@/components/sidebar";
import { PushNotificationsButton } from "@/components/push-notifications-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { signOutAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const ICON_MAP: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboardIcon,
  "/requests/new": FilmIcon,
  "/admin/dashboard": LayoutDashboardIcon,
  "/admin/companies": BuildingIcon,
  "/supervisor/dashboard": LayoutDashboardIcon,
  "/supervisor/operators": UsersIcon,
};

interface DashboardShellProps {
  title: string;
  subtitle: string;
  items: { href: string; label: string }[];
  children: React.ReactNode;
}

export function DashboardShell({
  title,
  subtitle,
  items,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/40">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <DashboardSidebar
          title={title}
          subtitle={subtitle}
          items={items}
          pathname={pathname}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar — visible only on mobile */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4 md:hidden">
          {/* Mobile: hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
                <MenuIcon className="size-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <div className="p-6 pb-4">
                <SheetTitle className="text-base font-bold">Doctor Engagement</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {title}
                </SheetDescription>
              </div>
              <Separator />
              <nav className="flex-1 space-y-1 px-4 py-4">
                {items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = ICON_MAP[item.href] ?? LayoutDashboardIcon;
                  return (
                    <Button
                      key={item.href}
                      variant={active ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-3",
                        active && "bg-muted font-semibold",
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
              <div className="p-4">
                <PushNotificationsButton />
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
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile: app name */}
          <span className="text-sm font-semibold md:hidden">Doctor Engagement</span>

          <div className="flex-1" />

          {/* Right: user + sign out */}
          <div className="flex items-center gap-1">
            <div className="hidden sm:block">
              <PushNotificationsButton compact />
            </div>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {subtitle}
            </span>
            <form action={signOutAction}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
              >
                <LogOutIcon className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Main — no padding, pages manage their own */}
        <main className="flex-1 overflow-y-auto bg-muted/40">
          {children}
        </main>
      </div>
    </div>
  );
}
