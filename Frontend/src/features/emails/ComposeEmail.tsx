import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { FileUp, ChevronDown, Plus } from "lucide-react";
import { emailService, senderService } from "./email.service";
import AddSenderModal from "./AddSenderModal";
import type { CsvParseResult, Sender } from "../../types/email";

interface ComposeEmailProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ComposeEmail({ onSuccess, onCancel }: ComposeEmailProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [sendersError, setSendersError] = useState(false);
  const [showAddSenderModal, setShowAddSenderModal] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [delaySec, setDelaySec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadSenders = useCallback(async () => {
    setLoadingSenders(true);
    setSendersError(false);
    try {
      const res = await senderService.list();
      setSenders(res.data);
      if (res.data.length > 0) {
        setSenderId((prev) => prev || res.data[0]!.id);
      }
    } catch {
      setSendersError(true);
    } finally {
      setLoadingSenders(false);
    }
  }, []);

  useEffect(() => {
    loadSenders();
  }, [loadSenders]);

  const handleSenderAdded = (newSender: Sender) => {
    setSenders((prev) => [newSender, ...prev]);
    setSenderId(newSender.id);
  };

  const handleCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setParsing(true);
    setParseResult(null);
    try {
      const { data } = await emailService.parseCsv(file);
      setParseResult(data);
      toast.success(`${data.validEmails} valid emails parsed`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "CSV parse failed";
      toast.error(msg);
      setCsvFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderId) return toast.error("Please select a sender");
    if (!parseResult || parseResult.validEmails === 0) {
      return toast.error("Please upload a valid CSV/TXT with recipients");
    }
    if (!subject.trim() || !body.trim()) {
      return toast.error("Subject and body are required");
    }
    if (new Date(startTime).getTime() < Date.now()) {
      return toast.error("Start time must be in the future");
    }

    setSubmitting(true);
    try {
      const { data } = await emailService.schedule({
        senderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: parseResult.recipients,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmails: delaySec * 1000,
        hourlyLimit,
      });
      toast.success(`Scheduled ${data.queued} emails!`);
      onSuccess?.();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { error?: string } } };
      toast.error(errObj.response?.data?.error ?? "Failed to schedule campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded-full px-4 py-2.5 text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-gray-800">

      {/* Sender Field with 4 Situational UI States */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-semibold text-gray-900">Sender</label>
          {senders.length > 0 && !loadingSenders && !sendersError && (
            <button
              type="button"
              onClick={() => setShowAddSenderModal(true)}
              className="text-xs font-semibold text-gray-900 hover:text-emerald-700 flex items-center gap-1 transition cursor-pointer"
            >
              <Plus size={13} />
              Add Sender
            </button>
          )}
        </div>

        {loadingSenders ? (
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50 text-center flex items-center justify-center gap-2 text-sm text-gray-500 font-medium">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
            Loading senders...
          </div>
        ) : sendersError ? (
          <div className="border border-red-200 rounded-2xl p-3.5 bg-red-50 flex items-center justify-between">
            <span className="text-xs font-medium text-red-700">Unable to load senders.</span>
            <button
              type="button"
              onClick={loadSenders}
              className="px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : senders.length === 0 ? (
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">No sender accounts added yet</p>
              <p className="text-xs text-gray-500 mt-0.5">Add an email sender account to start sending campaigns.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddSenderModal(true)}
              className="px-4 py-2 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold shadow-sm transition whitespace-nowrap cursor-pointer shrink-0"
            >
              Add Sender
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative border border-gray-200 rounded-2xl bg-white p-3 shadow-sm hover:border-gray-300 transition">
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full text-sm font-medium text-gray-900 bg-transparent focus:outline-none cursor-pointer appearance-none pr-8"
                required
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.senderEmail} ({s.senderName})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <ChevronDown size={17} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Select the email account you want to send from.
              </p>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5">Subject</label>
        <input
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5">Email Body</label>
        <textarea
          rows={5}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your email message..."
          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition resize-none"
        />
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center cursor-pointer hover:border-gray-400 transition"
      >
        <FileUp className="mx-auto text-gray-400 mb-2" size={30} />
        <p className="text-sm font-semibold text-gray-700">Upload CSV / TXT</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {csvFile ? csvFile.name : "Upload your email leads file"}
        </p>

        {parseResult ? (
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium border border-green-300">
            {parseResult.validEmails} emails detected
          </span>
        ) : (
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium border border-gray-200">
            {parsing ? "Parsing…" : "0 emails detected"}
          </span>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleCsvChange}
          className="hidden"
        />
      </div>

      {parseResult && (
        <div className="text-xs space-y-0.5 px-1">
          <p className="text-gray-500">
            <span className="font-medium text-gray-700">{parseResult.totalRows}</span> rows found
            &nbsp;/&nbsp;
            <span className="font-medium text-green-600">{parseResult.validEmails}</span> valid email addresses
            {parseResult.invalidEmails > 0 && (
              <>
                &nbsp;/&nbsp;
                <span className="font-medium text-red-500">{parseResult.invalidEmails}</span> invalid addresses
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold mb-1.5">Start Date &amp; Time</label>
          <input
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">Delay (seconds)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={delaySec}
            onChange={(e) => setDelaySec(Number(e.target.value))}
            placeholder="2"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5">Hourly Limit</label>
        <input
          type="number"
          min={1}
          max={500}
          value={hourlyLimit}
          onChange={(e) => setHourlyLimit(Number(e.target.value))}
          placeholder="100"
          className={inputCls}
        />
      </div>

      <div className="space-y-2 pt-1">
        <button
          type="submit"
          disabled={submitting || !parseResult || parseResult.validEmails === 0}
          className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-full transition"
        >
          {submitting ? "Scheduling…" : "Schedule Emails"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium py-2.5 rounded-full transition cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      <AddSenderModal
        open={showAddSenderModal}
        onClose={() => setShowAddSenderModal(false)}
        onSenderAdded={handleSenderAdded}
      />
    </form>
  );
}
