import { useEffect, useState, useCallback } from "react";
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
      const list = Array.isArray(data)
        ? data
        : (data as unknown as { emails: ScheduledEmail[] }).emails ?? [];
      setEmails(list);
      setPage(1);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Unable to load emails.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();

    const interval = setInterval(() => {
      fetchEmails(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchEmails]);

  return (
    <EmailTable
      mode="sent"
      emails={emails}
      loading={loading}
      error={error}
      page={page}
      onPageChange={setPage}
      onRefresh={() => fetchEmails()}
    />
  );
}
