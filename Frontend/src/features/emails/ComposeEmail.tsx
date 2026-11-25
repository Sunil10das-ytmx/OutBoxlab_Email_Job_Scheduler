import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FileUp } from "lucide-react";
import { emailService, senderService } from "./email.service";
import type { CsvParseResult, Sender } from "../../types/email";

interface ComposeEmailProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ComposeEmail({ onSuccess, onCancel }: ComposeEmailProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
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

  useEffect(() => {
    senderService
      .list()
      .then((res) => {
        setSenders(res.data);
        if (res.data.length > 0) setSenderId(res.data[0]!.id);
      })
      .catch(() => toast.error("Failed to load senders"));
  }, []);

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

      <div>
        <label className="block text-sm font-semibold mb-1.5">Sender</label>
        {senders.length === 0 ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            No senders found. Add one via POST&nbsp;/api/senders first.
          </p>
        ) : (
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className={inputCls + " cursor-pointer appearance-none"}
            required
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.senderName} &lt;{s.senderEmail}&gt;
                {s.useEthereal ? " [Ethereal]" : ""}
              </option>
            ))}
          </select>
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
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium py-2.5 rounded-full transition"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
