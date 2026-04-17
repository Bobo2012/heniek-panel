import { isAuthorized, readSoulFile, saveSoulFile, unauthorizedResponse } from "@/lib/panel-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  try {
    const result = await readSoulFile();
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        content: "",
        exists: false,
        message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as { content?: string };
    const result = await saveSoulFile(body.content ?? "");
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        saved: false,
        message,
      },
      { status: 500 }
    );
  }
}
