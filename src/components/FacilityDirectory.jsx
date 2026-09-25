"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Navigation,
  Search,
  Upload,
  Download,
  Trash2,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  FileSpreadsheet,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

const PAGE_SIZE = 30;

const inputCls =
  "rounded-md border border-border/80 bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-primary/70";

export const FacilityDirectory = ({ meta, onImported }) => {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null); // single delete fallback
  const [showSampleDropdown, setShowSampleDropdown] = useState(false);

  const fileRef = useRef(null);
  const dropdownRef = useRef(null);

  const load = () => {
    setLoading(true);
    return api
      .get("/facilities", {
        params: { q: q || undefined, district, facility_type: type },
      })
      .then(({ data }) => {
        setFacilities(data || []);
      })
      .catch(() => setFacilities([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    setPage(1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, district, type]);

  // Close sample dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSampleDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Pagination calculations
  const totalItems = facilities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const currentFacilities = facilities.slice(startIndex, endIndex);

  // Selection handlers
  const isAllCurrentSelected =
    currentFacilities.length > 0 &&
    currentFacilities.every((f) => selectedIds.has(f.id));

  const toggleSelectAllCurrent = () => {
    const next = new Set(selectedIds);
    if (isAllCurrentSelected) {
      currentFacilities.forEach((f) => next.delete(f.id));
    } else {
      currentFacilities.forEach((f) => next.add(f.id));
    }
    setSelectedIds(next);
  };

  const selectAllMatching = () => {
    const next = new Set(facilities.map((f) => f.id));
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Upload handler (CSV or Excel)
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    const toastId = toast.loading(`Importing ${file.name}...`);
    try {
      const { data } = await api.post("/facilities/import", fd);
      toast.success(
        `Imported ${data.imported} facilities (${data.total_facilities} total)`,
        { id: toastId }
      );
      load();
      onImported?.();
    } catch (err) {
      toast.error(
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "File import failed — please verify Excel or CSV format",
        { id: toastId }
      );
    } finally {
      e.target.value = "";
    }
  };

  // Bulk or single delete execution
  const executeDelete = async () => {
    const idsToDelete = itemToDelete
      ? [itemToDelete.id]
      : Array.from(selectedIds);

    if (idsToDelete.length === 0) return;

    setDeleting(true);
    const toastId = toast.loading(`Deleting ${idsToDelete.length} facilities...`);
    try {
      const { data } = await api.delete("/facilities", {
        data: { ids: idsToDelete },
      });
      toast.success(data?.message || `Deleted ${idsToDelete.length} facilities`, {
        id: toastId,
      });

      // Clear selection and modals
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setShowDeleteModal(false);
      setItemToDelete(null);

      await load();
      onImported?.();
    } catch (err) {
      toast.error(
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Failed to delete facilities",
        { id: toastId }
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="panel p-5 sm:p-6">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Assam · ESIC / ESIS network</p>
          <h2 className="text-xl font-bold sm:text-2xl">Facility directory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalItems} of {meta?.facility_count ?? totalItems} facilities found
            {totalPages > 1 && ` · Page ${safePage} of ${totalPages}`}
          </p>
        </div>

        {/* Toolbar & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
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

          {/* District Filter */}
          <select
            data-testid="facility-filter-district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className={inputCls}
          >
            <option value="all">All districts</option>
            {(meta?.districts || []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            data-testid="facility-filter-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputCls}
          >
            <option value="all">All types</option>
            {(meta?.facility_types || []).map((t) => (
              <option key={t} value={t}>
                {t === "Tie-Up Hospital" ? "Tie-Up Facility" : t}
              </option>
            ))}
          </select>

          {/* Download Sample Button with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              data-testid="download-sample-button"
              onClick={() => setShowSampleDropdown((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/60 px-3 py-2 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-secondary hover:border-primary/50"
              title="Download sample template with 3 example facilities"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Sample Template</span>
            </button>

            {showSampleDropdown && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-md border border-border/80 bg-card p-1.5 shadow-xl animate-in fade-in zoom-in-95">
                <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  Download 3-Example Template:
                </p>
                <a
                  href="/api/facilities/sample?format=xlsx"
                  download="facilities_sample_template.xlsx"
                  onClick={() => setShowSampleDropdown(false)}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 hover:text-primary"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="font-semibold leading-tight">Excel (.xlsx)</p>
                    <p className="text-[10px] text-muted-foreground">Standard spreadsheet with 3 samples</p>
                  </div>
                </a>
                <a
                  href="/api/facilities/sample?format=csv"
                  download="facilities_sample_template.csv"
                  onClick={() => setShowSampleDropdown(false)}
                  className="mt-1 flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 hover:text-primary"
                >
                  <FileText className="h-4 w-4 text-sky-500" />
                  <div>
                    <p className="font-semibold leading-tight">CSV (.csv)</p>
                    <p className="text-[10px] text-muted-foreground">Comma-separated with 3 samples</p>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Import CSV / Excel */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={upload}
            className="hidden"
            data-testid="facility-import-input"
          />
          <button
            data-testid="facility-import-csv-button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-all duration-200 hover:brightness-110 shadow-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Bulk Action & Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white">
              {selectedIds.size}
            </span>
            <span className="font-semibold text-foreground">
              {selectedIds.size} facility{selectedIds.size > 1 ? "ies" : ""} selected
            </span>
            {selectedIds.size < totalItems && (
              <button
                type="button"
                onClick={selectAllMatching}
                className="ml-2 font-medium text-primary underline underline-offset-2 hover:opacity-80"
              >
                Select all {totalItems} matching
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            >
              <X className="h-3 w-3" /> Deselect all
            </button>
            <button
              type="button"
              data-testid="facility-bulk-delete-button"
              onClick={() => {
                setItemToDelete(null);
                setShowDeleteModal(true);
              }}
              className="flex items-center gap-1.5 rounded bg-destructive px-3 py-1 font-bold text-destructive-foreground shadow hover:brightness-110"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Page Select-All Bar */}
      {currentFacilities.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-b border-border/50 pb-2 text-xs text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-2 select-none hover:text-foreground">
            <input
              type="checkbox"
              checked={isAllCurrentSelected}
              onChange={toggleSelectAllCurrent}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
            />
            <span className="font-medium">
              {isAllCurrentSelected
                ? "Deselect this page"
                : `Select all on page (${currentFacilities.length})`}
            </span>
          </label>

          <span className="mono text-[11px]">
            Showing {startIndex + 1}–{endIndex} of {totalItems} facilities
          </span>
        </div>
      )}

      {/* Facility Cards Grid */}
      {currentFacilities.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
          <p className="font-semibold">No facilities found</p>
          <p className="text-xs mt-1">Try refining your search keyword or district filter, or import new records.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {currentFacilities.map((f) => {
            const isSelected = selectedIds.has(f.id);
            return (
              <div
                key={f.id}
                data-testid="facility-directory-card"
                className={`relative group rounded-md border p-4 transition-all duration-200 hover:-translate-y-0.5 ${
                  isSelected
                    ? "border-destructive/60 bg-destructive/5 shadow-sm"
                    : "border-border/70 bg-secondary/40 hover:border-primary/50"
                }`}
              >
                {/* Top header row with Selection Checkbox & Single Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 pr-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(f.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
                      title="Select for bulk delete"
                    />
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {f.name}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setItemToDelete(f);
                      setShowDeleteModal(true);
                    }}
                    className="opacity-40 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                    title={`Delete ${f.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground pl-6">
                  {f.address}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] pl-6">
                  <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                    {f.facility_type === "Tie-Up Hospital" ? "Tie-Up Facility" : f.facility_type}
                  </span>
                  <span className="rounded border border-border/70 px-1.5 py-0.5 text-muted-foreground">
                    {f.district}
                  </span>
                  {f.pincode && (
                    <span className="mono text-muted-foreground/80">{f.pincode}</span>
                  )}
                  {f.phone && (
                    <span className="mono text-muted-foreground/80 text-[10px]">{f.phone}</span>
                  )}
                  {f.latitude && f.longitude && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto text-primary/80 transition-colors duration-200 hover:text-primary"
                      title="Open Google Maps direction"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls (after 30 items per page) */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
            <span className="font-semibold text-foreground">{endIndex}</span> of{" "}
            <span className="font-semibold text-foreground">{totalItems}</span> facilities (30 per page)
          </p>

          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(1)}
              className="flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary/40 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded border border-border bg-secondary/40 px-2.5 h-8 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>

            {/* Page Number Pills */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 7) return true;
                  if (p === 1 || p === totalPages) return true;
                  return Math.abs(p - safePage) <= 1;
                })
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) {
                    acc.push({ type: "ellipsis", key: `ell-${p}` });
                  }
                  acc.push({ type: "page", value: p, key: `p-${p}` });
                  return acc;
                }, [])
                .map((item) => {
                  if (item.type === "ellipsis") {
                    return (
                      <span key={item.key} className="px-1 text-xs text-muted-foreground">
                        …
                      </span>
                    );
                  }
                  const isCurrent = item.value === safePage;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPage(item.value)}
                      className={`h-8 min-w-[32px] px-2 rounded text-xs font-semibold transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : "border border-border/80 bg-secondary/30 text-foreground hover:bg-secondary"
                      }`}
                    >
                      {item.value}
                    </button>
                  );
                })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 rounded border border-border bg-secondary/40 px-2.5 h-8 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              disabled={safePage === totalPages}
              onClick={() => setPage(totalPages)}
              className="flex h-8 w-8 items-center justify-center rounded border border-border bg-secondary/40 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Footer Instructions with column format */}
      <div className="mono mt-6 border-t border-border/60 pt-4 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p>
          Supported file formats: <span className="text-foreground font-medium">Excel (.xlsx, .xls)</span> and <span className="text-foreground font-medium">CSV (.csv)</span>.
        </p>
      </div>

      {/* Confirmation Modal for Bulk or Single Deletion */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Confirm Deletion
                </h3>
                <p className="text-xs text-muted-foreground">
                  Permanent removal from directory
                </p>
              </div>
            </div>

            <div className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {itemToDelete ? (
                <p>
                  Are you sure you want to permanently delete{" "}
                  <strong className="text-foreground">{itemToDelete.name}</strong>?
                </p>
              ) : (
                <p>
                  Are you sure you want to permanently delete{" "}
                  <strong className="text-foreground">
                    {selectedIds.size} selected facilit{selectedIds.size > 1 ? "ies" : "y"}
                  </strong>
                  ? This will immediately remove them from the database and nearest facility suggestions.
                </p>
              )}
              <p className="mt-2 text-destructive font-medium">
                This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
                }}
                className="rounded-md border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={executeDelete}
                className="flex items-center gap-1.5 rounded-md bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground shadow hover:brightness-110 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{deleting ? "Deleting..." : "Yes, Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

