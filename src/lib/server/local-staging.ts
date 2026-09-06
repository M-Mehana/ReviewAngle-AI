import "server-only";

type RequestHeaders = Pick<Headers, "get">;
const localAuthority = /^(localhost|127\.0\.0\.1)(?::([1-9]\d{0,4}))?$/;

function isLocalAuthority(value: string) {
  const match = localAuthority.exec(value);
  return !!match && (!match[2] || Number(match[2]) <= 65535);
}

// Do not trust a forwarded hostname to grant unauthenticated access.
// The staging launcher also binds the listener exclusively to 127.0.0.1.
export function localStagingAllowed(headers: RequestHeaders, url?: URL) {
  if (process.env.LOCAL_STAGING_MODE !== "true") return false;
  if (process.env.NODE_ENV === "production")
    throw new Error("Local staging cannot run in production.");
  if (process.env.DEMO_MODE === "true")
    throw new Error("Choose local staging or synthetic demo, never both.");
  const host = headers.get("host") || "";
  if (!isLocalAuthority(host)) return false;
  // NextURL canonicalizes loopback IPs to localhost. Validate the original
  // Host strictly, and compare ports rather than the normalized hostname.
  if (
    url &&
    (!isLocalAuthority(url.host) || url.port !== new URL(`http://${host}`).port)
  )
    return false;
  if (headers.get("forwarded")) return false;
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost !== host) return false;
  const forwardedFor = headers.get("x-forwarded-for");
  if (
    forwardedFor &&
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(forwardedFor)
  )
    return false;
  const protocol = url?.protocol || "http:";
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedProto && `${forwardedProto}:` !== protocol) return false;
  const origin = headers.get("origin");
  if (origin && origin !== `${protocol}//${host}`) return false;
  if (headers.get("sec-fetch-site") === "cross-site") return false;
  return true;
}
