import { redirect } from "next/navigation";

import { Profile, UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  ops: "/dashboard",
  supervisor: "/supervisor/dashboard",
};

export function homeForRole(role: UserRole) {
  return HOME_BY_ROLE[role] ?? "/login";
}

export async function getCurrentUserAndProfile(): Promise<{
  userId: string;
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/login");
  }

  return { userId: user.id, profile };
}

export async function requireRole(role: UserRole | UserRole[]) {
  const { profile } = await getCurrentUserAndProfile();
  const allowed = Array.isArray(role) ? role : [role];

  if (!allowed.includes(profile.role)) {
    redirect(homeForRole(profile.role));
  }

  return profile;
}
