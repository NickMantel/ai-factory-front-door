import { Suspense } from "react";
import { CoEUseCase } from "@/components/CoEUseCase";
import { PageSpinner } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <CoEUseCase />
    </Suspense>
  );
}
