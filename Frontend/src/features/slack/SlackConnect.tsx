import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, RefreshCw } from "lucide-react";
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
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

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

  /* ── 1. LOADING STATE (Checking Slack status...) ──────────────────── */
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-2 w-full">
        <div className="flex justify-center mb-2">
          <RefreshCw size={26} className="animate-spin text-gray-600" />
        </div>
        <p className="text-base font-semibold text-gray-900">
          Checking Slack status...
        </p>
        <p className="text-sm text-gray-500">
          Backend API se status check ho raha hai
        </p>
      </div>
    );
  }

  /* ── 2. CONNECTED STATE ───────────────────────────────────────────── */
  if (status?.connected) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center space-y-3.5 w-full">
        <div className="flex justify-center">
          <span className="px-3.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            Connected
          </span>
        </div>

        <div className="flex justify-center">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>

        <p className="text-sm font-medium text-gray-800">
          Slack successfully connected
        </p>

        <div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-sm font-bold text-gray-900 hover:text-red-600 transition cursor-pointer disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>
    );
  }

  /* ── 3. NOT CONNECTED STATE ───────────────────────────────────────── */
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center space-y-3.5 w-full">
      <div className="flex justify-center">
        <span className="px-3.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
          Not connected
        </span>
      </div>

      <div className="flex justify-center">
        <svg
          className="w-7 h-7"
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
            d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-5.8 12.9-12.9 12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
            fill="#ECB22E"
          />
        </svg>
      </div>

      <p className="text-sm font-medium text-gray-800">Slack not connected</p>

      <div>
        <button
          type="button"
          onClick={handleConnect}
          className="text-sm font-bold text-gray-900 hover:text-emerald-700 transition cursor-pointer"
        >
          Connect Slack
        </button>
      </div>
    </div>
  );
}
