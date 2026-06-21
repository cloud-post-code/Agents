"use client";

import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-xl shadow p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Welcome to Artisan!</h1>
        <p className="text-gray-600 mb-6">
          Your AI co-workers are ready. Let&apos;s set up your workspace.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="bg-black text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-800"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
