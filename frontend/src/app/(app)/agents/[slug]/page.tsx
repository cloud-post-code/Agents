import { notFound } from "next/navigation";
import { AGENTS, getAgent } from "@/lib/agents";
import { AgentShell } from "@/components/agents/AgentShell";

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

  // -m-6 undoes the layout's p-6 so chat fills the full pane
  return (
    <div className="-m-6 h-[calc(100vh-0px)] flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <AgentShell agent={agent} />
    </div>
  );
}
