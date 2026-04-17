import { exec } from "child_process";

export async function GET() {
    return new Promise((resolve) => {
        exec("docker ps --filter name=hermes-agent --format '{{.Status}}'", (error, stdout) => {
            if (error) {
                resolve(
                    Response.json({
                        status: "error",
                        message: error.message,
                    })
                );
            } else {
                resolve(
                    Response.json({
                        status: stdout.trim() || "stopped",
                    })
                );
            }
        });
    });
}