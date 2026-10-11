"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

const CrmIntegratedView = dynamic(
  () => import("@/components/CrmIntegratedView").then((mod) => mod.CrmIntegratedView),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f7f9] text-[#556370] text-sm">
        Loading CRM Dashboard...
      </div>
    ),
  }
);

export default function CrmPage() {
  useEffect(() => {
    document.title = "CRM Dashboard";
  }, []);

  return <CrmIntegratedView />;
}
