import type { ReactNode } from "react";
import { StoreHeader } from "@/components/vendora/layout/store-chrome";

/**
 * Shared shell for every /account screen. The approved account frames end
 * with their page content and intentionally do not include the store footer.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StoreHeader />
      <main className="min-h-[60vh]">{children}</main>
    </>
  );
}
