import { Suspense } from "react";
import { Workspace } from "@/components/workspace";
export default function AppPage() {
  return (
    <Suspense fallback={<div className="loading-page">불러오는 중…</div>}>
      <Workspace />
    </Suspense>
  );
}
