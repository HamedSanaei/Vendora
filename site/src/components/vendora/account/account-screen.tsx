import type { ReactNode } from "react";
import { AccountPageFrame } from "@/components/vendora/account/account-chrome";
import {
  AccountPageHeader,
  type Crumb,
} from "@/components/vendora/ui/page-header";

/**
 * Shared scaffold for every account screen: page frame (sidebar/drawer),
 * breadcrumb row and the title/subtitle/action header, matching the
 * Penpot account layout composition.
 */
export function AccountScreen({
  crumbs,
  title,
  subtitle,
  action,
  children,
}: {
  crumbs: Crumb[];
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AccountPageFrame crumbs={crumbs}>
      <div className="space-y-6">
        <div className="hidden lg:block lg:pt-[11px]">
          <AccountPageHeader title={title} subtitle={subtitle} action={action} />
        </div>
        {children}
      </div>
    </AccountPageFrame>
  );
}
