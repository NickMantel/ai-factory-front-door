import { Suspense } from "react";
import { Workspace } from "@/components/Workspace";
import { PageSpinner } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Workspace />
    </Suspense>
  );
}
