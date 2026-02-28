"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect to issues page - the main municipality interface
export default function MunicipalityDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/municipality/issues");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-500">Redirecting...</div>
    </div>
  );
}
