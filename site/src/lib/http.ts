import axios from "axios";

const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5020";
const apiRoot = configuredBaseUrl.replace(/\/+$/, "").replace(/\/api$/i, "");

/** Shared storefront transport; the environment may specify the API origin or its /api URL. */
export const http = axios.create({
  baseURL: `${apiRoot}/api`,
  headers: { Accept: "application/json" },
  timeout: 15000,
});

/** Resolves backend image paths from the API origin, never relative to the /api endpoint prefix. */
export function resolveApiImageUrl(imageUrl: string): string {
  return new URL(imageUrl, new URL(configuredBaseUrl).origin).toString();
}
