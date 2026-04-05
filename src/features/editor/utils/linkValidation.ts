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

export function isSafeLinkHref(input: string): boolean {
  const trimmed = input.trim();

  if (trimmed === "") {
    return false;
  }

  if (RELATIVE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}
