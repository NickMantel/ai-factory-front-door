import { Suspense } from "react";
import { SignIn } from "@/components/SignIn";
import { PageSpinner } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <SignIn />
    </Suspense>
  );
}
