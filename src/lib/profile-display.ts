export function profileDisplayName(
  profile: { full_name: string | null; email: string | null } | null | undefined,
) {
  return profile?.full_name?.trim() || profile?.email?.trim() || "Unknown";
}
