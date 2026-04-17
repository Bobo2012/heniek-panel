import { type NextRequest } from "next/server";
import { getContainerLogs, isAuthorized, unauthorizedResponse } from "@/lib/panel-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  try {
    const tailParam = Number(request.nextUrl.searchParams.get("tail") || "120");
    const data = await getContainerLogs(tailParam);
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        logs: "",
        error: message,
      },
      { status: 500 }
    );
  }
}
