import { createFileRoute } from "@tanstack/react-router";
import { buildUninstallScript } from "@/lib/powershell-scripts";

// GET /api/public/uninstall.ps1
// Kør med:
//   irm https://<domæne>/api/public/uninstall.ps1 | iex
export const Route = createFileRoute("/api/public/uninstall.ps1")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(buildUninstallScript(), {
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
