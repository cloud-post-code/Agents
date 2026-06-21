import { notFound } from "next/navigation";
import { AGENTS, getAgent } from "@/lib/agents";
import { AgentShell } from "@/components/agents/AgentShell";
import { Sidebar } from "@/components/layout/Sidebar";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return AGENTS.map((a) => ({ slug: a.slug }));
}

export default async function AgentPage({ params }: PageProps) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <AgentShell agent={agent} />
      </main>
    </div>
  );
}
