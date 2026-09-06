export type DomainPolicy = "supported" | "manual-import-only" | "disabled";
const domains = (value: string | undefined) =>
  value
    ?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) || [];
export function domainPolicy(host: string): DomainPolicy {
  const matches = (domain: string) =>
    host === domain || host.endsWith(`.${domain}`);
  if (domains(process.env.URL_DISABLED_DOMAINS).some(matches))
    return "disabled";
  return domains(process.env.URL_SUPPORTED_DOMAINS).some(matches)
    ? "supported"
    : "manual-import-only";
}
export function requireSupported(url: URL) {
  const policy = domainPolicy(url.hostname);
  if (policy !== "supported")
    throw new Error(
      policy === "disabled"
        ? "Importing from this domain is disabled."
        : "This source currently supports manual import only. Paste reviews or upload a CSV file.",
    );
}
