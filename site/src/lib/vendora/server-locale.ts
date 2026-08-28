import { headers } from "next/headers";
import type { Locale } from "./types";

/**
 * Reads the active locale from the proxy-injected request header.
 * The `/fa` / `/en` prefix remains the single source of truth.
 */
export async function getServerLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-vendora-locale") === "en" ? "en" : "fa";
}
