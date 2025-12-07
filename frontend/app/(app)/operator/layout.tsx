export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { OperatorShell } from "@/components/operator-shell";

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <OperatorShell>{children}</OperatorShell>
    </AuthGuard>
  );
}
