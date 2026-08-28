import { redirect } from "next/navigation";

/**
 * Legacy account route. The Penpot-based account area now lives under
 * `/[locale]/account`; this path is kept as a permanent alias.
 */
export default function UserDashboardPage() {
  redirect("/account");
}
