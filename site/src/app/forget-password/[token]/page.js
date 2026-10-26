import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/vendora/server-locale";
/** Retires the development token URL and directs customers to verified-phone recovery. */
export default async function LegacyPasswordReset() { redirect(`/${await getServerLocale()}/forgot`); }
