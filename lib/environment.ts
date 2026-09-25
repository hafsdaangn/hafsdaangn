import { isSchoolEmail } from "./domain";
export function appEnvironment(
  value = process.env.APP_ENV,
): "production" | "development" {
  if (value === undefined) return "production";
  if (value === "production" || value === "development") return value;
  throw new Error("APP_ENV must be production or development.");
}
export function allowedEmail(
  email: string | undefined,
  environment = appEnvironment(),
) {
  return environment === "development" ? Boolean(email) : isSchoolEmail(email);
}
