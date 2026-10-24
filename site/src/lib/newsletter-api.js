import { http } from './http';

/**
 * Sends a storefront newsletter email subscription to the ASP.NET Core API.
 * @param {string} email Subscriber email address.
 * @param {"fa" | "en"} locale Active storefront locale.
 * @returns {Promise<{message: string}>} Localized-safe API result message.
 */
export async function subscribeToNewsletter(email, locale) {
  return (await http.post('/newsletter/subscriptions', { email, locale })).data;
}
