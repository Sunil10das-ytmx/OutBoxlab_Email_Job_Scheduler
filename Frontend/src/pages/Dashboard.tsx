import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Search } from "lucide-react";
import Header from "../components/Header";
import Sidebar, { type SidebarSection } from "../components/Sidebar";
import Modal from "../components/Modal";
import Button from "../components/Button";
import ScheduledEmails from "../features/emails/ScheduledEmails";
import SentEmails from "../features/emails/SentEmails";
import ComposeEmail from "../features/emails/ComposeEmail";
import SlackConnect from "../features/slack/SlackConnect";
import { emailService } from "../features/emails/email.service";
import type { ScheduledEmail } from "../types/email";

/* ── inline search-results table (lightweight) ─────────────────── */
function SearchResultsTable({ emails }: { emails: ScheduledEmail[] }) {
  const STATUS_STYLES: Record<string, string> = {
    pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
    queued:    "bg-blue-100   text-blue-700   border-blue-200",
    sending:   "bg-purple-100 text-purple-700 border-purple-200",
    sent:      "bg-green-100  text-green-700  border-green-200",
    failed:    "bg-red-100    text-red-700    border-red-200",
    cancelled: "bg-gray-100   text-gray-500   border-gray-200",
    unknown:   "bg-gray-100   text-gray-500   border-gray-200",
  };
  if (emails.length === 0)
    return <p className="text-sm text-gray-400 py-8 text-center">No matching emails found.</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {["Email", "Subject", "Scheduled Time", "Status"].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {emails.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-800 font-medium max-w-[200px] truncate">
                {e.recipientEmail ?? e.recipient ?? "—"}
              </td>
              <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate">{e.subject}</td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {new Date(e.scheduledAt).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_STYLES[e.status] ?? STATUS_STYLES.unknown}`}>
                  {e.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────── */
export default function Dashboard({
  initialSection = "scheduled",
}: {
  initialSection?: "scheduled" | "sent" | "compose" | "slack";
}) {
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">(
    initialSection === "sent" ? "sent" : "scheduled"
  );
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>(
    initialSection === "slack"
      ? "integrations"
      : initialSection === "sent"
        ? "sent"
        : "dashboard"
  );
  const [composeModalOpen, setComposeModalOpen] = useState(
    initialSection === "compose"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ScheduledEmail[] | null>(null);
  const [searching, setSearching] = useState(false);

  /* compose success → switch to scheduled tab */
  const [composeKey, setComposeKey] = useState(0);

  const handleSidebarSelect = (section: SidebarSection) => {
    setSidebarSection(section);
    if (section === "scheduled") setActiveTab("scheduled");
    if (section === "sent") setActiveTab("sent");
    setSearchResults(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const { data } = await emailService.search(searchQuery.trim());
      const list = Array.isArray(data)
        ? data
        : (data as unknown as { emails: ScheduledEmail[] }).emails ?? [];
      setSearchResults(list);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <div className="flex flex-1">
        <Sidebar activeSection={sidebarSection} onSelect={handleSidebarSelect} />

        <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">

          {/* top bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Email Dashboard</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage your email campaigns</p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setComposeModalOpen(true)}>
                <Plus size={16} />
                Compose New Email
              </Button>
            </div>
          </div>

          {sidebarSection === "integrations" ? (
            <div className="max-w-2xl">
              <SlackConnect />
            </div>
          ) : (
            <>
              {/* search bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search emails by recipient or subject…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <Button onClick={handleSearch} disabled={searching}>
                  <Search size={15} />
                  {searching ? "Searching…" : "Search"}
                </Button>
                {searchResults && (
                  <Button
                    variant="secondary"
                    onClick={() => { setSearchResults(null); setSearchQuery(""); }}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* tabs */}
              {!searchResults && (
                <div className="flex items-center gap-6 border-b border-slate-200">
                  {(["scheduled", "sent"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => { setActiveTab(tab); setSidebarSection(tab); }}
                      className={`pb-3 text-sm font-semibold border-b-2 transition capitalize ${
                        activeTab === tab
                          ? "border-gray-900 text-gray-900"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab === "scheduled" ? "Scheduled Emails" : "Sent Emails"}
                    </button>
                  ))}
                </div>
              )}

              {/* content */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                {searchResults ? (
                  <SearchResultsTable emails={searchResults} />
                ) : activeTab === "scheduled" ? (
                  <ScheduledEmails key={composeKey} />
                ) : (
                  <SentEmails />
                )}
              </div>

              {/* ── Integration Section on Dashboard ────────────────── */}
              <div className="pt-2">
                <SlackConnect />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Compose Modal */}
      <Modal
        open={composeModalOpen}
        title="Compose New Email"
        onClose={() => setComposeModalOpen(false)}
      >
        <ComposeEmail
          onSuccess={() => {
            setComposeModalOpen(false);
            setActiveTab("scheduled");
            setSidebarSection("scheduled");
            setComposeKey((k) => k + 1); // force ScheduledEmails re-fetch
          }}
          onCancel={() => setComposeModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
