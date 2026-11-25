import { Clock, LayoutDashboard, Plug, Send } from "lucide-react";

export type SidebarSection = "dashboard" | "scheduled" | "sent" | "integrations";

interface SidebarProps {
  activeSection: SidebarSection;
  onSelect: (section: SidebarSection) => void;
}

const NAV_ITEMS: Array<{
  id: SidebarSection;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
  { id: "scheduled", label: "Scheduled Emails", icon: <Clock size={17} /> },
  { id: "sent", label: "Sent Emails", icon: <Send size={17} /> },
  { id: "integrations", label: "Integrations", icon: <Plug size={17} /> },
];

export default function Sidebar({ activeSection, onSelect }: SidebarProps) {
  return (
    <aside className="w-60 bg-white border-r border-slate-200 min-h-[calc(100vh-65px)] p-4 hidden md:flex flex-col gap-2">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left cursor-pointer ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
