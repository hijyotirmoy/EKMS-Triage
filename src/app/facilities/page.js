"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { FacilityDirectory } from "@/components/FacilityDirectory";

export default function FacilitiesPage() {
  useEffect(() => {
    document.title = "Triage Facility";
  }, []);

  return (
    <AppShell activePage="facilities">
      {({ meta, loadMeta }) => (
        <FacilityDirectory meta={meta} onImported={loadMeta} />
      )}
    </AppShell>
  );
}

