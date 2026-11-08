import "server-only";
import { importJWK, SignJWT, type JWK } from "jose";
// This key authorizes DB/Storage/Realtime access; login uses our own sessions.
function signingJwk(): JWK {
  const jwk = JSON.parse(
    process.env.SUPABASE_SIGNING_JWK ?? "null",
  ) as JWK | null;
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.kid)
    throw new Error("Configure the imported ES256 SUPABASE_SIGNING_JWK.");
  return jwk;
}
export function databaseTokenConfigured() {
  try {
    signingJwk();
    return true;
  } catch {
    return false;
  }
}
export async function databaseToken(userId: string, sessionId: string) {
  const jwk = signingJwk();
  const key = await importJWK(jwk, "ES256");
  return new SignJWT({ role: "authenticated", app_session_id: sessionId })
    .setProtectedHeader({ alg: "ES256", kid: jwk.kid!, typ: "JWT" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuer(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
