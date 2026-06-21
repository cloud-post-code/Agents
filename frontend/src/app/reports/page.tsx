import { Sidebar } from "@/components/layout/Sidebar";

export default function ReportsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <h1 className="text-2xl font-bold mb-4">Reports</h1>
        <p className="text-gray-400">No reports generated yet.</p>
      </main>
    </div>
  );
}
