import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import EmailTable from "./EmailTable";
import { emailService } from "./email.service";
import type { ScheduledEmail } from "../../types/email";

export default function ScheduledEmails() {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchEmails = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data } = await emailService.getScheduled();
      const list = Array.isArray(data)
        ? data
        : (data as unknown as { emails: ScheduledEmail[] }).emails ?? [];
      setEmails(list);
      setPage(1);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to load scheduled emails";
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await emailService.cancel(id);
      toast.success("Email cancelled");
      fetchEmails(true);
    } catch {
      toast.error("Failed to cancel email");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <EmailTable
      mode="scheduled"
      emails={emails}
      loading={loading}
      error={error}
      page={page}
      onPageChange={setPage}
      onRefresh={() => fetchEmails()}
      onCancel={handleCancel}
      cancellingId={cancellingId}
    />
  );
}
