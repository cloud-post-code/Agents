export interface AgentConfig {
  slug: string;
  name: string;
  role: string;
  color: string;
  icon: string;
  tagline: string;
  description: string;
  detail: string;
  capabilities: string[];
  examples: string[];
}

export const AGENTS: AgentConfig[] = [
  {
    slug: "strategist",
    name: "Strategist",
    role: "strategist",
    color: "indigo",
    icon: "📈",
    tagline: "Your sharp business advisor",
    description: "Pricing, market analysis, and growth strategy",
    detail:
      "The Strategist thinks like a seasoned business consultant who knows the handmade market inside out. Ask about pricing, seasonal trends, channel performance, or where to focus next quarter. You'll get a direct opinion, not a wall of bullet points.",
    capabilities: [
      "Pricing analysis and competitive benchmarking",
      "Revenue forecasting and seasonal planning",
      "Channel strategy (Etsy, Facebook, in-person, wholesale)",
      "Market trend analysis",
      "Margin and profitability reviews",
      "Holiday and event-based promotion planning",
    ],
    examples: [
      "Should I lower my prices for the holiday season?",
      "Which of my products has the best margin?",
      "What channels should I focus on this quarter?",
      "Am I priced competitively for handmade ceramics?",
    ],
  },
  {
    slug: "product-manager",
    name: "Product Manager",
    role: "product_manager",
    color: "emerald",
    icon: "📦",
    tagline: "Your hands-on inventory expert",
    description: "Catalog management, stock tracking, and product updates",
    detail:
      "The Product Manager lives in your stockroom. They know what's running low, what's selling, and how to keep your catalog clean and up to date. Upload a photo, paste a CSV, or just describe what you need — they'll handle the rest.",
    capabilities: [
      "Add products from a photo, CSV, or description",
      "Track stock levels and get low-inventory alerts",
      "Edit, remove, or bulk-update catalog listings",
      "Manage product variants (size, color, material)",
      "Attach and reorder product images",
      "Catalog search and filtering",
    ],
    examples: [
      "Add this product from the photo I just uploaded",
      "Which products are running low?",
      "Show me my full catalog",
      "Update the price on my ceramic mug to $38",
    ],
  },
  {
    slug: "marketer",
    name: "Marketer",
    role: "marketer",
    color: "rose",
    icon: "📣",
    tagline: "Your on-brand creative engine",
    description: "Social posts, fliers, and copy written in your brand voice",
    detail:
      "The Marketer knows your brand DNA and uses it for everything. Before writing a single word they check your brand profile — if it's set up, every caption, flier, and listing will sound unmistakably like you. If it isn't, they'll walk you through setting it up first.",
    capabilities: [
      "Social media captions for Instagram, Facebook, TikTok, X, and Pinterest",
      "Branded product fliers (square, portrait, landscape)",
      "SEO-optimized listing copy for Etsy and Amazon",
      "Brand voice setup and DNA profile",
      "Multi-platform post batches from a single product",
      "Creative briefs and promotional copy",
    ],
    examples: [
      "Make posts for my Indigo Woven Basket",
      "Create a flier for my summer sale",
      "Write an Etsy listing for my hand-poured candle",
      "Set up my brand voice",
    ],
  },
  {
    slug: "admin",
    name: "Admin",
    role: "admin",
    color: "amber",
    icon: "🗂️",
    tagline: "Your organized back-office partner",
    description: "Business profile, orders, revenue summaries, and shipping",
    detail:
      "The Admin keeps the back office running so you don't have to. Tell them your address, shipping policies, or business details and they'll save it instantly. Ask for a revenue summary or order overview and you'll get a clean card — no spreadsheets required.",
    capabilities: [
      "Save and update your business profile (address, contact, policies)",
      "Order tracking and fulfillment status",
      "Revenue summaries by period",
      "Shipping method and rate management",
      "Expense tracking and back-office reporting",
      "Business operations Q&A",
    ],
    examples: [
      "My address is 123 Main St, Boston MA 02101",
      "Show me this month's revenue",
      "What orders are still unfulfilled?",
      "Update my shipping policy to free shipping over $75",
    ],
  },
];

export function getAgent(slug: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.slug === slug);
}
