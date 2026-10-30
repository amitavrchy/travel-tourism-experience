import { Account } from "@/components/account";
import { Suspense } from "react";
export const metadata = {
  title: "My journeys",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
