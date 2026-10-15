import { isIP } from "node:net";

/** Block SSRF to private / link-local targets when probing seller URLs. */
export function assertSafeOutboundUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_protocol");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    // Allow localhost in demo / local-dev
    if (process.env.ALLOW_LOCALHOST !== "false") return url;
    throw new Error("localhost_blocked");
  }
  const ipVersion = isIP(host);
  if (ipVersion) {
    if (isPrivateIp(host)) throw new Error("private_ip_blocked");
  }
  return url;
}

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.")) {
    return true;
  }
  if (ip.startsWith("169.254.")) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}
