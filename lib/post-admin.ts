import "server-only";

export function isPostAdmin(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .some((entry) => entry.trim().toLowerCase() === normalized);
}
