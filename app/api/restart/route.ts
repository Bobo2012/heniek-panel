import { isAuthorized, restartPanel, unauthorizedResponse } from "@/lib/panel-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  try {
    const result = await restartPanel();
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        restarted: false,
        message,
      },
      { status: 500 }
    );
  }
}
