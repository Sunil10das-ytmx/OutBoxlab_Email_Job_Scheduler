
import {
  RefreshCw,
  AlertCircle,
  Inbox,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { ScheduledEmail } from "../../types/email";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  queued:    "bg-blue-100   text-blue-700   border-blue-200",
  sending:   "bg-purple-100 text-purple-700 border-purple-200",
  sent:      "bg-green-100  text-green-700  border-green-200",
  failed:    "bg-red-100    text-red-700    border-red-200",
  cancelled: "bg-gray-100   text-gray-500   border-gray-200",
  unknown:   "bg-gray-100   text-gray-500   border-gray-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
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
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <RefreshCw size={28} className="animate-spin mb-3" />
        <p className="text-sm">
          Loading {mode === "scheduled" ? "scheduled" : "sent"} emails…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-400">
        <AlertCircle size={32} className="mb-3" />
        <p className="text-sm font-medium mb-4">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 rounded-full border border-red-300 text-red-500 text-xs font-semibold hover:bg-red-50 transition"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Inbox size={40} className="mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">
          {mode === "scheduled" ? "No scheduled emails" : "No sent emails yet"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {mode === "scheduled"
            ? "Compose a new campaign to get started."
            : "Delivered and failed emails will appear here."}
        </p>
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
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition"
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
                          className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
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
              className="p-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
