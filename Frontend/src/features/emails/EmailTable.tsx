
import {
  RefreshCw,
  AlertCircle,
  CalendarClock,
  Mail,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { ScheduledEmail } from "../../types/email";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-50 text-yellow-700 border-yellow-200",
  queued:    "bg-blue-50   text-blue-700   border-blue-200",
  sending:   "bg-purple-50 text-purple-700 border-purple-200",
  sent:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed:    "bg-red-50    text-red-700    border-red-200",
  cancelled: "bg-gray-100  text-gray-500   border-gray-200",
  unknown:   "bg-gray-100  text-gray-500   border-gray-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-3 py-0.5 rounded-full text-xs font-medium border capitalize ${
        STATUS_STYLES[status] ?? STATUS_STYLES["unknown"]
      }`}
    >
      {status}
    </span>
  );
}

export interface EmailTableProps {
  mode: "scheduled" | "sent";
  emails: ScheduledEmail[];
  loading: boolean;
  error?: string | null;
  page: number;
  onPageChange: (p: number) => void;
  onRefresh?: () => void;
  onCompose?: () => void;
  onCancel?: (id: string) => void;
  cancellingId?: string | null;
}

export default function EmailTable({
  mode,
  emails,
  loading,
  error,
  page,
  onPageChange,
  onRefresh,
  onCompose,
  onCancel,
  cancellingId,
}: EmailTableProps) {
  const totalPages = Math.max(1, Math.ceil(emails.length / PAGE_SIZE));
  const paged = emails.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const timeHeader = mode === "scheduled" ? "Scheduled Time" : "Sent Time";
  const cols = ["Email", "Subject", timeHeader, "Status"];
  if (mode === "scheduled" && onCancel) cols.push("");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        {mode === "scheduled" ? (
          <div className="w-7 h-7 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
        ) : (
          <RefreshCw size={26} className="animate-spin text-gray-600" />
        )}
        <p className="text-sm text-gray-700 font-medium">
          {mode === "scheduled"
            ? "Loading scheduled emails..."
            : "Loading sent emails..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-1">
          <AlertCircle size={24} />
        </div>
        <p className="text-base font-semibold text-gray-800">
          Unable to load emails.
        </p>
        <p className="text-sm text-gray-500">Please try again.</p>
        {onRefresh && (
          <div className="pt-3">
            <button
              type="button"
              onClick={onRefresh}
              className="px-6 py-2 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 mb-1 border border-slate-100">
          {mode === "scheduled" ? (
            <CalendarClock size={24} className="text-slate-600" />
          ) : (
            <Mail size={24} className="text-slate-600" />
          )}
        </div>
        <p className="text-base font-semibold text-slate-900">
          {mode === "scheduled"
            ? "No scheduled emails yet"
            : "No sent emails yet"}
        </p>
        <p className="text-sm text-slate-500 max-w-sm">
          {mode === "scheduled"
            ? "Your scheduled emails will appear here."
            : "Your sent emails will appear here."}
        </p>
        {mode === "scheduled" && onCompose && (
          <div className="pt-3">
            <button
              type="button"
              onClick={onCompose}
              className="px-6 py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-medium shadow-sm transition cursor-pointer"
            >
              Compose New Email
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          <span className="font-semibold text-gray-800">{emails.length}</span>{" "}
          {mode === "scheduled" ? "scheduled" : "sent"} emails
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition cursor-pointer"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {cols.map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide ${
                    h === "" ? "w-10" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {paged.map((email) => {
              const recipient =
                email.recipientEmail ?? email.recipient ?? "—";

              const timeValue =
                mode === "scheduled"
                  ? email.scheduledAt
                  : (email.sentAt ?? email.scheduledAt);

              const canCancel =
                mode === "scheduled" &&
                (email.status === "pending" || email.status === "queued");

              return (
                <tr
                  key={email.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-800 font-medium max-w-[200px] truncate">
                    {recipient}
                  </td>

                  <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate">
                    {email.subject}
                  </td>

                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(timeValue).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge status={email.status} />
                  </td>

                  {mode === "scheduled" && onCancel && (
                    <td className="px-4 py-3 text-right">
                      {canCancel && (
                        <button
                          onClick={() => onCancel(email.id)}
                          disabled={cancellingId === email.id}
                          title="Cancel this email"
                          className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40 cursor-pointer"
                        >
                          {cancellingId === email.id ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <X size={13} />
                          )}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition cursor-pointer"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition cursor-pointer"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
