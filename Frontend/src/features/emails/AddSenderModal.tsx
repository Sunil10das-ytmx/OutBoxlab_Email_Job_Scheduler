import { useState } from "react";
import toast from "react-hot-toast";
import { Mail, Sparkles } from "lucide-react";
import Modal from "../../components/Modal";
import { senderService } from "./email.service";
import type { Sender } from "../../types/email";

interface AddSenderModalProps {
  open: boolean;
  onClose: () => void;
  onSenderAdded: (newSender: Sender) => void;
}

export default function AddSenderModal({
  open,
  onClose,
  onSenderAdded,
}: AddSenderModalProps) {
  const [mode, setMode] = useState<"ethereal" | "custom">("ethereal");
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.ethereal.email");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");

  const handleCreateEthereal = async () => {
    setSubmitting(true);
    try {
      const res = await senderService.create({
        senderName: senderName.trim() || "Test Sender",
        senderEmail: "auto-generated@ethereal.email",
        useEthereal: true,
      });
      const created = res.data.sender;
      toast.success("Sender added successfully");
      onSenderAdded(created);
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } } };
      toast.error(errObj.response?.data?.error ?? "Failed to add sender");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderEmail.trim()) {
      return toast.error("Sender name and email are required");
    }
    if (!smtpUsername.trim() || !smtpPassword.trim()) {
      return toast.error("SMTP username and password are required");
    }

    setSubmitting(true);
    try {
      const res = await senderService.create({
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim(),
        smtpHost: smtpHost.trim() || "smtp.ethereal.email",
        smtpPort: Number(smtpPort) || 587,
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword.trim(),
        useEthereal: false,
      });
      const created = res.data.sender;
      toast.success("Sender added successfully");
      onSenderAdded(created);
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } } };
      toast.error(errObj.response?.data?.error ?? "Failed to add sender");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition";

  return (
    <Modal open={open} title="Add Email Sender Account" onClose={onClose}>
      <div className="space-y-4">
        {/* Mode Selector Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setMode("ethereal")}
            className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
              mode === "ethereal"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            <Sparkles size={14} />
            Quick Test Account (Ethereal)
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex-1 pb-2.5 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
              mode === "custom"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            <Mail size={14} />
            Custom SMTP Details
          </button>
        </div>

        {mode === "ethereal" ? (
          <div className="space-y-3.5 py-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 space-y-1">
              <p className="font-semibold">⚡ Instant Sandbox SMTP</p>
              <p className="text-emerald-700">
                Auto-generates a free Ethereal test inbox for safe campaign testing. No SMTP setup required.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Outreach Team"
                className={inputCls}
              />
            </div>

            <button
              type="button"
              onClick={handleCreateEthereal}
              disabled={submitting}
              className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-xs py-3 rounded-full transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Creating Sender…" : "Create Test Sender Account"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateCustom} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sender Name *
                </label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sender Email *
                </label>
                <input
                  type="email"
                  required
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="john@example.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  required
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Port *
                </label>
                <input
                  type="number"
                  required
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  placeholder="587"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  SMTP Username *
                </label>
                <input
                  type="text"
                  required
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="user@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  SMTP Password *
                </label>
                <input
                  type="password"
                  required
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-xs py-3 rounded-full transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Saving Sender…" : "Save Sender Account"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
