"use client";

import { AgentConfig } from "@/lib/agents";

interface AgentShellProps {
  agent: AgentConfig;
}

export function AgentShell({ agent }: AgentShellProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h1 className="text-xl font-semibold">{agent.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Ask me anything about your {agent.role.replace("_", " ")} domain</p>
      </div>
    </div>
  );
}
