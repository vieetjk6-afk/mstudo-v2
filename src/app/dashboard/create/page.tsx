"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CreateAlbumFlow, { CreateHero } from "@/components/CreateAlbumFlow";

function CreateInner() {
  const mode = useSearchParams().get("phase") === "delivery" ? "delivery" : "selection";
  return (
    <div className="page-in">
      <CreateHero mode={mode} />
      <CreateAlbumFlow mode={mode} />
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateInner />
    </Suspense>
  );
}
