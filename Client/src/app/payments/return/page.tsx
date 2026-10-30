import { Suspense } from "react";
import { PaymentReturn } from "@/components/payment-return";
export const metadata = {
  title: "Your payment",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense>
      <PaymentReturn />
    </Suspense>
  );
}
