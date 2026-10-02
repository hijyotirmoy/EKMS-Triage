"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Mail, Copy, Check, X, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function UnderDevModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const isDismissed = sessionStorage.getItem("ekms_dev_modal_dismissed");
      if (!isDismissed) {
        // Small delay to ensure smooth slide-in after initial render
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    } catch (_) {}
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    try {
      sessionStorage.setItem("ekms_dev_modal_dismissed", "true");
    } catch (_) {}
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("jyotimoy.choudhary@piramalswasthya.org");
      setCopied(true);
      toast.success("Email copied: jyotimoy.choudhary@piramalswasthya.org");
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      toast.info("Dev Team: jyotimoy.choudhary@piramalswasthya.org");
    }
  };

  // Keyboard Esc key listener
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Gradient Banner */}
        <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-500" />

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close Notice"
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-7">
          {/* Header Badge & Title */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400 shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 mb-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Active Development Notice
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                EKMS Triage Platform is under development
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            Active development in progress. Certain features and clinical tools are undergoing continuous enhancement.
          </p>

          {/* Contact Support Box */}
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 sm:p-4 mb-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
              <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Contact Developer Team For Queries & Support:</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg">
              <div className="font-mono text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 select-all truncate">
                jyotimoy.choudhary@piramalswasthya.org
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <a
                  href="mailto:jyotimoy.choudhary@piramalswasthya.org?subject=EKMS%20Triage%20Query%20/%20Feedback"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </a>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-md transition-all active:scale-[0.98] text-center"
            >
              I Understand & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
