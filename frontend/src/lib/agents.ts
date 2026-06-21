export interface AgentConfig {
  slug: string;
  name: string;
  description: string;
  role: string;
  color: string;
}

export const AGENTS: AgentConfig[] = [
  {
    slug: "strategist",
    name: "Strategist",
    description: "Market analysis, pricing strategy, and business growth planning",
    role: "strategist",
    color: "indigo",
  },
  {
    slug: "product-manager",
    name: "Product Manager",
    description: "Inventory management, catalog curation, and product catalog updates",
    role: "product_manager",
    color: "emerald",
  },
  {
    slug: "marketer",
    name: "Marketer",
    description: "SEO optimization, listing copy, and brand voice for your shop",
    role: "marketer",
    color: "rose",
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Accounting, shipping logistics, and operational back-office tasks",
    role: "admin",
    color: "amber",
  },
];

export function getAgent(slug: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.slug === slug);
}
