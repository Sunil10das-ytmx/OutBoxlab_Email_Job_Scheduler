import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, API_BASE } from "../../services/api";
import type { SlackStatus } from "../../types/user";

export default function SlackConnect() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get<SlackStatus>(
        "/api/integrations/slack/status"
      );
      setStatus(response.data);
    } catch {
      // If error or unauthenticated, default to not connected
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Check query params after OAuth redirect from backend
    const params = new URLSearchParams(window.location.search);
    if (params.get("slack") === "connected") {
      toast.success("Slack connected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
      fetchStatus();
    } else if (params.get("slack") === "error") {
      toast.error("Slack connection failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleConnect = () => {
    const apiUrl = import.meta.env.VITE_API_URL || API_BASE;
    window.location.href = `${apiUrl}/api/integrations/slack/connect`;
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.post("/api/integrations/slack/disconnect");
      toast.success("Slack disconnected");
      setStatus({ connected: false });
    } catch {
      toast.error("Failed to disconnect Slack");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 w-full">
      {/* ── Header: Slack Icon + Title + Badge ───────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          {/* Slack 4-color icon */}
          <svg
            className="w-5 h-5 shrink-0"
            viewBox="0 0 122.8 122.8"
            aria-hidden="true"
          >
            <path
              d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
              fill="#E01E5A"
            />
            <path
              d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
              fill="#36C5F0"
            />
            <path
              d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
              fill="#2EB67D"
            />
            <path
              d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
              fill="#ECB22E"
            />
          </svg>
          <h3 className="text-base font-semibold text-gray-900 tracking-tight">
            Slack Integration
          </h3>
        </div>

        {/* Status pill badge */}
        {status?.connected ? (
          <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Connected
          </span>
        ) : (
          <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Example
          </span>
        )}
      </div>

      {/* ── Subtitle / Description ───────────────────────────────────── */}
      <p className="text-sm text-gray-500 mb-5 leading-relaxed">
        Connect Slack to receive notifications when an email sender reaches the
        hourly sending limit.
      </p>

      {/* ── Action Button / State ────────────────────────────────────── */}
      {loading ? (
        <div className="w-full bg-gray-100 text-gray-400 text-sm font-semibold py-3 rounded-full text-center animate-pulse">
          Checking status…
        </div>
      ) : status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800">
            <span className="font-medium">
              ✓ Connected to Slack{status.teamName ? ` (${status.teamName})` : ""}
            </span>
            {status.channelId && (
              <span className="font-mono text-emerald-700">
                Channel: {status.channelId}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm font-semibold py-2.5 rounded-full transition cursor-pointer disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect Slack"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 text-sm font-semibold py-3 rounded-full transition cursor-pointer"
        >
          Connect Slack
        </button>
      )}
    </div>
  );
}
