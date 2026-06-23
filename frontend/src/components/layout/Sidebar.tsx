"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AGENTS } from "@/lib/agents";

const AGENT_ICONS: Record<string, string> = {
  strategist: "📈",
  product_manager: "📦",
  marketer: "📣",
  admin: "🗂️",
};

const AGENT_COLORS: Record<string, { active: string; dot: string }> = {
  strategist:      { active: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  product_manager: { active: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  marketer:        { active: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  admin:           { active: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

const WORKSPACE_ITEMS = [
  { href: "/dashboard",     label: "Dashboard",     icon: "⊞" },
  { href: "/tasks",         label: "Tasks",         icon: "✓" },
  { href: "/inventory",     label: "Inventory",     icon: "📦" },
  { href: "/calendar",      label: "Calendar",      icon: "◻" },
  { href: "/reports",       label: "Reports",       icon: "▤" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/brand",         label: "Brand DNA",     icon: "🎨" },
  { href: "/marketing",     label: "Marketing",     icon: "📣" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { tenant, logout } = useAuth();

  return (
    <aside className="w-64 h-screen flex flex-col border-r bg-white shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">Artisan</p>
            {tenant && (
              <p className="text-[10px] text-gray-400 leading-tight truncate max-w-[140px]">
                {tenant.display_name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">

        {/* Workspace */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1">
            Workspace
          </p>
          {WORKSPACE_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm mb-0.5 transition-colors ${
                  active
                    ? "bg-gray-100 font-medium text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* AI Team */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1">
            AI Team
          </p>
          {AGENTS.map((agent) => {
            const href = `/agents/${agent.slug}`;
            const active = pathname.startsWith(href);
            const colors = AGENT_COLORS[agent.role] || { active: "bg-gray-100 text-gray-700", dot: "bg-gray-400" };
            return (
              <Link
                key={agent.slug}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 mb-0.5 transition-colors ${
                  active ? colors.active : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-base leading-none w-5 text-center shrink-0">{agent.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium leading-tight ${active ? "" : "text-gray-700"}`}>
                    {agent.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate leading-tight">
                    {agent.tagline}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t p-3">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <span>→</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
