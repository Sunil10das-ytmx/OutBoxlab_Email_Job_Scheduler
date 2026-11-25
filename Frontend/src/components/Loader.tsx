import { Loader2 } from "lucide-react";

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export default function Loader({ text = "Loading...", fullScreen = false }: LoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-slate-500 ${
        fullScreen ? "min-h-screen bg-slate-50" : "py-14"
      }`}
    >
      <Loader2 size={28} className="animate-spin text-indigo-600" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
