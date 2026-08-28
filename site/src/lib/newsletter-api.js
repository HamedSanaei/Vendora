const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5020";

/**
 * Sends a storefront newsletter email subscription to the ASP.NET Core API.
 * @param {string} email Subscriber email address.
 * @param {"fa" | "en"} locale Active storefront locale.
 * @returns {Promise<{message: string}>} Localized-safe API result message.
 */
export async function subscribeToNewsletter(email, locale) {
  const response = await fetch(`${apiBaseUrl}/api/newsletter/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, locale }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Newsletter subscription failed.");
  }

  return data;
}
