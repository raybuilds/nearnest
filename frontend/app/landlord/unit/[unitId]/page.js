import { redirect } from "next/navigation";

export default function LandlordUnitPage({ params }) {
  redirect(`/unit/${params.unitId}`);
}
