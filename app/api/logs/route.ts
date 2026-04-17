import { exec } from "child_process";

function execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout.trim());
        });
    });
}

export async function GET(): Promise<Response> {
    try {
        const logs = await execCommand("docker logs --tail 50 hermes-agent");

        return Response.json({
            logs,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unknown error";

        return Response.json(
            {
                logs: "",
                error: message,
            },
            { status: 500 }
        );
    }
}