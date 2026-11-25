import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import EmailTable from "./EmailTable";
import { emailService } from "./email.service";
import type { ScheduledEmail } from "../../types/email";

export default function SentEmails() {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchEmails = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data } = await emailService.getSent();
      /* handle both { emails: [...] } and plain array */
      const list = Array.isArray(data)
        ? data
        : (data as unknown as { emails: ScheduledEmail[] }).emails ?? [];
      setEmails(list);
      setPage(1);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to load sent emails";
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  return (
    <EmailTable
      mode="sent"
      emails={emails}
      loading={loading}
      error={error}
      page={page}
      onPageChange={setPage}
      onRefresh={() => fetchEmails()}
      /* no onCancel — sent emails cannot be cancelled */
    />
  );
}
