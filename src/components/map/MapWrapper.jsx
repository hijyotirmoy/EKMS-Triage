"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import React, { forwardRef } from "react";

const DynamicAssamMap = dynamic(() => import("./AssamMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
      <p className="text-xs font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
        Loading Assam GeoJSON &amp; Health Map...
      </p>
    </div>
  ),
});

export const MapWrapper = forwardRef(function MapWrapper(props, ref) {
  return <DynamicAssamMap ref={ref} {...props} />;
});

export default MapWrapper;
