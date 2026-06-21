import Link from "next/link";
import { AGENTS } from "@/lib/agents";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {AGENTS.map((agent) => (
          <Link
            key={agent.slug}
            href={`/agents/${agent.slug}`}
            className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
          >
            <h2 className="font-semibold">{agent.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{agent.description}</p>
          </Link>
        ))}
      </div>
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold mb-2">Notifications</h2>
        <p className="text-sm text-gray-400">No notifications yet.</p>
      </div>
    </div>
  );
}
