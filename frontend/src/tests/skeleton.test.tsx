import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AgentShell } from "@/components/agents/AgentShell";
import { AGENTS } from "@/lib/agents";

describe("Agent chat shells", () => {
  const agents = [
    { slug: "strategist", name: "Strategist", descPattern: /market|pricing|strategy/i },
    { slug: "product-manager", name: "Product Manager", descPattern: /inventory|catalog/i },
    { slug: "marketer", name: "Marketer", descPattern: /seo|listing|brand/i },
    { slug: "admin", name: "Admin", descPattern: /accounting|shipping/i },
  ];

  agents.forEach(({ slug, name, descPattern }) => {
    it(`renders ${name} shell with name and description`, () => {
      const agent = AGENTS.find((a) => a.slug === slug)!;
      render(<AgentShell agent={agent} />);
      expect(screen.getByText(name)).toBeDefined();
      const desc = screen.getByText(descPattern);
      expect(desc).toBeDefined();
    });
  });
});

describe("Agent config completeness", () => {
  it("has all 4 required agents", () => {
    const slugs = AGENTS.map((a) => a.slug);
    expect(slugs).toContain("strategist");
    expect(slugs).toContain("product-manager");
    expect(slugs).toContain("marketer");
    expect(slugs).toContain("admin");
  });

  it("each agent has name and description", () => {
    for (const agent of AGENTS) {
      expect(agent.name.length).toBeGreaterThan(0);
      expect(agent.description.length).toBeGreaterThan(0);
    }
  });
});
