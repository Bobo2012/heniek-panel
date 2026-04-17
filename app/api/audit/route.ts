import { type NextRequest } from "next/server";
import { isAuthorized, readAuditLog, unauthorizedResponse } from "@/lib/panel-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20");
    const data = await readAuditLog(limit);
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        entries: [],
        message,
      },
      { status: 500 }
    );
  }
}
