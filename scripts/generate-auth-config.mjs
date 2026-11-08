import { randomBytes, randomUUID } from "node:crypto";
import { readFile, appendFile } from "node:fs/promises";
import { generateKeyPair, exportJWK } from "jose";

// Never print private key material, and never replace an existing signing key.
let source = "";
try {
  source = await readFile(".env.local", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const configured = (key) => new RegExp(`^${key}=.+$`, "m").test(source);
const additions = [];
if (!configured("AUTH_SECRET"))
  additions.push(`AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
if (!configured("SUPABASE_SIGNING_JWK")) {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = {
    ...(await exportJWK(privateKey)),
    kid: randomUUID(),
    alg: "ES256",
    use: "sig",
  };
  additions.push(`SUPABASE_SIGNING_JWK=${JSON.stringify(jwk)}`);
}
if (additions.length) {
  await appendFile(".env.local", `\n${additions.join("\n")}\n`, {
    mode: 0o600,
  });
  console.log(
    "Saved missing OAuth/session configuration in .env.local; no existing keys were replaced.",
  );
} else
  console.log("OAuth/session signing keys already exist; no changes made.");
console.log(
  "Import the SUPABASE_SIGNING_JWK value into the project's JWT Signing Keys and activate it before cutover.",
);
