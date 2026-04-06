const ALLOWED_PROTOCOLS = new Set([
  "http:",
  "https:",
  "ftp:",
  "ftps:",
  "mailto:",
  "tel:",
  "callto:",
  "sms:",
  "cid:",
  "xmpp:",
]);

const RELATIVE_PREFIXES = ["#", "/", "./", "../", "?"];
const DEFAULT_EXTERNAL_PROTOCOL = "http://";

function isRelativeLinkHref(input: string): boolean {
  return RELATIVE_PREFIXES.some((prefix) => input.startsWith(prefix));
}

function hasAllowedProtocol(input: string): boolean {
  try {
    const url = new URL(input);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function isIpv4Hostname(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function canNormalizeSchemeLessHref(input: string): boolean {
  const colonIndex = input.indexOf(":");

  if (colonIndex === -1) {
    return true;
  }

  const possibleHost = input.slice(0, colonIndex).toLowerCase();

  return (
    possibleHost === "localhost" ||
    possibleHost.includes(".") ||
    isIpv4Hostname(possibleHost)
  );
}

function isExternalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.includes(".") ||
    hostname.includes(":") ||
    isIpv4Hostname(hostname)
  );
}

function hasAuthorityUserInfo(input: string): boolean {
  const authorityEndIndex = input.search(/[/?#]/);
  const authority =
    authorityEndIndex === -1 ? input : input.slice(0, authorityEndIndex);

  return authority.includes("@");
}

export function normalizeLinkHref(input: string): string | null {
  const trimmed = input.trim();

  if (trimmed === "") {
    return null;
  }

  if (isRelativeLinkHref(trimmed) || hasAllowedProtocol(trimmed)) {
    return trimmed;
  }

  if (!canNormalizeSchemeLessHref(trimmed) || hasAuthorityUserInfo(trimmed)) {
    return null;
  }

  try {
    const url = new URL(`${DEFAULT_EXTERNAL_PROTOCOL}${trimmed}`);

    if (!isExternalHostname(url.hostname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function isSafeLinkHref(input: string): boolean {
  return normalizeLinkHref(input) !== null;
}
