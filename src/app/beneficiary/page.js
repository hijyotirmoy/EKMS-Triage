"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const CrmIntegratedView = dynamic(
  () => import("@/components/CrmIntegratedView").then((mod) => mod.CrmIntegratedView || mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f7f9] text-[#556370] text-sm">
        Loading Beneficiary...
      </div>
    ),
  }
);

function BeneficiaryContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  useEffect(() => {
    document.title = id ? `Beneficiary - ${id}` : "Beneficiary";
  }, [id]);

  return (
    <CrmIntegratedView
      initialNav="Beneficiary"
      initialBeneficiaryViewMode={id ? "form" : "list"}
      initialBeneficiaryId={id}
    />
  );
}

export default function BeneficiaryPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#f5f7f9] text-[#556370] text-sm">
          Loading Beneficiary...
        </div>
      }
    >
      <BeneficiaryContent />
    </Suspense>
  );
}
