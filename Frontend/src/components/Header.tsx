import { LogOut, Send } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Button from "./Button";

export default function Header() {
  const { user, logout } = useAuth();
  const avatarUrl = user?.avatar || user?.picture;
  const initials = (user?.name ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm">
          <Send size={18} />
        </div>
        <span className="text-lg font-bold text-slate-900 tracking-tight">
          MailBox
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.name ?? "User"}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-xs flex items-center justify-center border border-indigo-100">
              {initials}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {user?.name ?? "User"}
            </p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={logout} title="Logout">
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
