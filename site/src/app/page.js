import { redirect } from "next/navigation";

export const metadata = {
  title: "Vendora Storefront",
};

export default function RootPage() {
  redirect("/fa");
}
