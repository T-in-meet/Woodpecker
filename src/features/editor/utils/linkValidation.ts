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
const ALLOWED_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

const RELATIVE_PREFIXES = ["#", "/", "./", "../", "?"];
const IMAGE_RELATIVE_PREFIXES = ["/", "./", "../"];
const DEFAULT_EXTERNAL_LINK_PROTOCOL = "http://";
const DEFAULT_EXTERNAL_IMAGE_PROTOCOL = "https://";

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

function hasUrlUserInfo(url: URL): boolean {
  return url.username !== "" || url.password !== "";
}

function unwrapMarkdownLinkDestination(input: string): string {
  return input.startsWith("<") && input.endsWith(">")
    ? input.slice(1, -1).trim()
    : input;
}

function normalizeHostnameForValidation(hostname: string): string {
  return hostname.replace(/\.+$/, "").toLowerCase();
}

export function normalizeLinkHref(input: string): string | null {
  const trimmed = unwrapMarkdownLinkDestination(input.trim());

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
    const url = new URL(`${DEFAULT_EXTERNAL_LINK_PROTOCOL}${trimmed}`);

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

function hasRelativeImagePathPrefix(input: string): boolean {
  if (input.startsWith("//")) {
    return false;
  }

  return IMAGE_RELATIVE_PREFIXES.some((prefix) => input.startsWith(prefix));
}

function hasAllowedImageHostname(hostname: string): boolean {
  const normalizedHostname = normalizeHostnameForValidation(hostname);

  if (
    normalizedHostname === "" ||
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    isIpv4Hostname(normalizedHostname) ||
    normalizedHostname.includes(":")
  ) {
    return false;
  }

  return normalizedHostname.includes(".");
}

function normalizeAbsoluteImageSrc(input: string): string | null {
  if (hasAuthorityUserInfo(input)) {
    return null;
  }

  try {
    const url = new URL(input);

    if (
      hasUrlUserInfo(url) ||
      !ALLOWED_IMAGE_PROTOCOLS.has(url.protocol) ||
      !hasAllowedImageHostname(url.hostname)
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeSchemeLessImageSrc(input: string): string | null {
  if (!canNormalizeSchemeLessHref(input) || hasAuthorityUserInfo(input)) {
    return null;
  }

  return normalizeAbsoluteImageSrc(
    `${DEFAULT_EXTERNAL_IMAGE_PROTOCOL}${input}`,
  );
}

function normalizeProtocolRelativeImageSrc(input: string): string | null {
  return normalizeAbsoluteImageSrc(`https:${input}`);
}

export function normalizeImageSrc(input: string): string | null {
  const trimmed = unwrapMarkdownLinkDestination(input.trim());

  if (trimmed === "") {
    return null;
  }

  if (trimmed.startsWith("//")) {
    return normalizeProtocolRelativeImageSrc(trimmed);
  }

  // Markdown images in notes are treated as external resources only. Relative
  // paths would resolve against the app origin instead of a user-provided host.
  if (hasRelativeImagePathPrefix(trimmed)) {
    return null;
  }

  const absoluteSrc = normalizeAbsoluteImageSrc(trimmed);

  if (absoluteSrc) {
    return absoluteSrc;
  }

  // Auto-loaded images should prefer HTTPS when we normalize bare hostnames.
  return normalizeSchemeLessImageSrc(trimmed);
}
