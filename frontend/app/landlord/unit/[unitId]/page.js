"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyLandlordUnitPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = params?.unitId;

  useEffect(() => {
    if (unitId) {
      router.replace(`/unit/${unitId}`);
    }
  }, [router, unitId]);

  return null;
}
