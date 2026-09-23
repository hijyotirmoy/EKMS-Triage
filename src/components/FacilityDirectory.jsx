"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Navigation, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

const inputCls =
  "rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-primary/70";

export const FacilityDirectory = ({ meta, onImported }) => {
  const [facilities, setFacilities] = useState([]);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("all");
  const [type, setType] = useState("all");
  const fileRef = useRef(null);

  const load = () =>
    api
      .get("/facilities", {
        params: { q: q || undefined, district, facility_type: type },
      })
      .then(({ data }) => setFacilities(data))
      .catch(() => setFacilities([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, district, type]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/facilities/import", fd);
      toast.success(`Imported ${data.imported} facilities (${data.total_facilities} total)`);
      load();
      onImported?.();
    } catch (err) {
      toast.error(
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "CSV import failed — check columns"
      );
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Assam · ESIC / ESIS network</p>
          <h2 className="text-xl font-bold sm:text-2xl">Facility directory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {facilities.length} of {meta?.facility_count ?? 0} facilities shown
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              data-testid="facility-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, address, pincode"
              className={`${inputCls} pl-8`}
            />
          </div>
          <select
            data-testid="facility-filter-district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className={inputCls}
          >
            <option value="all">All districts</option>
            {(meta?.districts || []).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            data-testid="facility-filter-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputCls}
          >
            <option value="all">All types</option>
            {(meta?.facility_types || []).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={upload}
            className="hidden"
            data-testid="facility-import-input"
          />
          <button
            data-testid="facility-import-csv-button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-all duration-200 hover:brightness-110"
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {facilities.map((f) => (
          <div
            key={f.id}
            data-testid="facility-directory-card"
            className="rounded-md border border-border/70 bg-secondary/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50"
          >
            <p className="flex items-start gap-2 text-sm font-semibold leading-snug">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
              {f.name}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.address}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                {f.facility_type}
              </span>
              <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                {f.district}
              </span>
              {f.pincode && <span className="mono text-muted-foreground/80">{f.pincode}</span>}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-primary/80 transition-colors duration-200 hover:text-primary"
              >
                <Navigation className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <p className="mono mt-6 border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
        CSV columns: name, facility_type, scheme, address, district, block, pincode, state,
        latitude, longitude, site_code, phone
      </p>
    </div>
  );
};
