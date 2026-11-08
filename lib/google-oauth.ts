import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { appEnvironment, allowedEmail } from "./environment";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export const oauthCookie = "hafs-google-oauth";
export const sessionSeconds = 90 * 24 * 60 * 60;
export const randomToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function appOrigin() {
  const url = new URL(process.env.APP_URL!);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error("APP_URL requires HTTPS (except localhost).");
  return url.origin;
}
export const secureCookies = () => new URL(appOrigin()).protocol === "https:";
export const sessionCookie = () =>
  secureCookies() ? "__Host-hafs-session" : "hafs-session";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: secureCookies(),
  sameSite: "lax" as const,
  path: "/",
});
function stateKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("AUTH_SECRET must contain at least 32 bytes.");
  return new TextEncoder().encode(secret);
}
export function googleConfigured() {
  try {
    appOrigin();
    stateKey();
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );
  } catch {
    return false;
  }
}
export async function beginGoogleLogin() {
  const state = randomToken(),
    nonce = randomToken(),
    verifier = randomToken();
  const cookie = await new SignJWT({ state, nonce, verifier })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(appOrigin())
    .setAudience("google-login")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateKey());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appOrigin()}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
    ...(appEnvironment() === "production" ? { hd: "hafs.hs.kr" } : {}),
  }).toString();
  return { url: url.toString(), cookie };
}
export async function readGoogleTransaction(cookie: string, state: string) {
  const { payload } = await jwtVerify(cookie, stateKey(), {
    algorithms: ["HS256"],
    issuer: appOrigin(),
    audience: "google-login",
  });
  if (
    typeof payload.state !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.verifier !== "string" ||
    Buffer.byteLength(state) !== Buffer.byteLength(payload.state) ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(payload.state))
  )
    throw new Error("Invalid OAuth transaction.");
  return { nonce: payload.nonce, verifier: payload.verifier };
}
export class GoogleMembershipError extends Error {}
export function validateGoogleClaims(payload: JWTPayload, nonce: string) {
  if (
    payload.nonce !== nonce ||
    !payload.sub ||
    (payload.azp !== undefined && payload.azp !== process.env.GOOGLE_CLIENT_ID)
  )
    throw new Error("Invalid Google identity.");
  if (
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !allowedEmail(payload.email) ||
    (appEnvironment() === "production" && payload.hd !== "hafs.hs.kr")
  )
    throw new GoogleMembershipError("학교 Google 계정으로 로그인해 주세요.");
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : "",
  };
}
export async function finishGoogleLogin(
  code: string,
  transaction: { nonce: string; verifier: string },
) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appOrigin()}/auth/callback`,
      grant_type: "authorization_code",
      code_verifier: transaction.verifier,
    }),
  });
  if (!response.ok) throw new Error("Google token exchange failed.");
  const data = await response.json();
  if (typeof data.id_token !== "string")
    throw new Error("Missing Google identity.");
  const { payload } = await jwtVerify(data.id_token, googleKeys, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
    requiredClaims: ["exp", "iat", "sub", "nonce"],
  });
  return validateGoogleClaims(payload, transaction.nonce);
}
