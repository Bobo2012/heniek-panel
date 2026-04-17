import { appendAuditLog, isAuthorized, restartPanel, unauthorizedResponse } from "@/lib/panel-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    await appendAuditLog(request, "restart", "warning", "Blocked restart attempt: unauthorized request.");
    return unauthorizedResponse();
  }

  try {
    const result = await restartPanel();
    await appendAuditLog(request, "restart", "success", result.message || "Restart command sent.");
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await appendAuditLog(request, "restart", "failure", message);
    return Response.json(
      {
        restarted: false,
        message,
      },
      { status: 500 }
    );
  }
}
