import { BrandSetupCard } from "@/components/a2ui/surfaces/BrandSetupCard";

export default function BrandPage() {
  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Brand DNA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define your brand identity, voice, and visual style. The Marketer agent uses this to write copy and create fliers that feel on-brand.
        </p>
      </div>
      <BrandSetupCard />
      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
        <h3 className="text-sm font-semibold text-rose-700 mb-1">How your brand DNA is used</h3>
        <ul className="text-xs text-rose-600 space-y-1 list-disc list-inside">
          <li>Social media captions are written in your brand voice with your tone adjectives</li>
          <li>Fliers use your colors, logo, and Google Font automatically</li>
          <li>The Marketer agent tailors copy to your target audience</li>
          <li>All generated content reflects your writing style and brand personality</li>
        </ul>
      </div>
    </div>
  );
}
