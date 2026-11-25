import { CheckCircle, Clock, HelpCircle, Send, XCircle } from "lucide-react";
import type { EmailStatus } from "../types/email";

const STATUS_COLORS: Record<EmailStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  queued: "bg-blue-100 text-blue-800",
  sending: "bg-orange-100 text-orange-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  unknown: "bg-slate-200 text-slate-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const STATUS_ICONS: Record<EmailStatus, React.ReactNode> = {
  pending: <Clock size={12} />,
  queued: <Clock size={12} />,
  sending: <Send size={12} />,
  sent: <CheckCircle size={12} />,
  failed: <XCircle size={12} />,
  unknown: <HelpCircle size={12} />,
  cancelled: <XCircle size={12} />,
};

export default function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
        STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {STATUS_ICONS[status]}
      {status}
    </span>
  );
}
