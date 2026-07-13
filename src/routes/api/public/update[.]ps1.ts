import { createFileRoute } from "@tanstack/react-router";
import { buildUpdateScript } from "@/lib/powershell-scripts";

// GET /api/public/update.ps1
// Kør med:
//   irm https://<domæne>/api/public/update.ps1 | iex
export const Route = createFileRoute("/api/public/update.ps1")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        return new Response(buildUpdateScript(origin), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
