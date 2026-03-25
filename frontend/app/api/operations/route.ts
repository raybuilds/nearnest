import { fetchBackend, getForwardHeaders } from "@/app/api/_utils";

export async function GET(request: Request) {
  const role = (request.headers.get("x-nearnest-role") || "").toLowerCase();
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get("intent");

  let dawnIntent = "operations_advisor";
  let message = "How is the housing system doing right now";

  if (role === "admin" && intent === "corridor_analysis") {
    dawnIntent = "admin_density";
    message = "Show highest complaint density by corridor";
  } else if (role === "landlord" && intent === "recurring_issues") {
    dawnIntent = "landlord_recurring";
    message = "Show recurring issues across my units";
  }

  return fetchBackend("/dawn/query", {
    method: "POST",
    headers: getForwardHeaders(request),
    body: {
      message,
      intent: dawnIntent,
    },
  });
}

