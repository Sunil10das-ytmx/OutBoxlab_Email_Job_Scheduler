import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle, MessageSquare, XCircle } from "lucide-react";
import Button from "../../components/Button";
import Loader from "../../components/Loader";
import { slackService } from "./slack.service";
import type { SlackStatus } from "../../types/user";

export default function SlackConnect() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = () => {
    setLoading(true);
    slackService
      .getStatus()
      .then((res) => setStatus(res.data))
      .catch(() => toast.error("Failed to load Slack status"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("slack") === "connected") {
      toast.success("Slack connected successfully");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("slack") === "error") {
      toast.error("Slack connection failed");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleConnect = () => {
    window.location.href = slackService.getConnectUrl();
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await slackService.disconnect();
      toast.success("Slack disconnected");
      setStatus({ connected: false });
    } catch {
      toast.error("Failed to disconnect Slack");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) return <Loader text="Checking Slack status..." />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-[#4A154B] rounded-xl flex items-center justify-center text-white">
          <MessageSquare size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Slack Integration
          </h2>
          <p className="text-sm text-slate-500">
            Receive rate-limit breach alerts in your Slack channel.
          </p>
        </div>
      </div>

      {status?.connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <CheckCircle className="text-green-600" size={20} />
            <div className="text-sm">
              <p className="font-semibold text-green-800">Connected</p>
              {status.channelId && (
                <p className="text-slate-600">
                  Channel ID: <code>{status.channelId}</code>
                </p>
              )}
            </div>
          </div>

          <Button
            variant="danger"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            <XCircle size={15} />
            {disconnecting ? "Disconnecting..." : "Disconnect Slack"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <XCircle className="text-slate-400" size={20} />
            <div className="text-sm">
              <p className="font-semibold text-slate-700">Not connected</p>
              <p className="text-slate-500">
                Connect Slack to get notified when hourly sender limits are hit.
              </p>
            </div>
          </div>

          <Button
            onClick={handleConnect}
            className="bg-[#4A154B] hover:bg-[#3b103c]"
          >
            <MessageSquare size={15} />
            Connect with Slack
          </Button>
        </div>
      )}
    </div>
  );
}
