"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENTS } from "@/lib/agents";

const NAV_ITEMS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/calendar", label: "Calendar" },
  { href: "/reports", label: "Reports" },
  { href: "/notifications", label: "Notifications" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-full flex flex-col border-r bg-white">
      <div className="p-4 border-b">
        <span className="font-bold text-lg">Artisan</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
          AI Co-workers
        </p>
        {AGENTS.map((agent) => {
          const href = `/agents/${agent.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={agent.slug}
              href={href}
              className={`flex flex-col rounded-lg px-3 py-2 transition-colors ${
                active ? "bg-gray-100" : "hover:bg-gray-50"
              }`}
            >
              <span className="text-sm font-medium">{agent.name}</span>
              <span className="text-xs text-gray-500 line-clamp-1">{agent.description}</span>
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            Workspace
          </p>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
