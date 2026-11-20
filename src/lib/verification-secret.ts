// The HMAC key for stored verification-code hashes and signed verified-phone
// tokens. One key for both so a deployment sets one secret; it falls back to the
// auth secret so development and the existing deployment keep working.

export function verificationSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.VERIFICATION_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "VERIFICATION_TOKEN_SECRET (or BETTER_AUTH_SECRET) is not set.",
    );
  }
  return secret;
}
