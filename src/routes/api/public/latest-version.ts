import { createFileRoute } from "@tanstack/react-router";
import { APP_VERSION, DOWNLOAD_PATH, CHANGELOG } from "@/lib/app-version";

// Publicly readable version manifest. Bruges af både PowerShell-installer
// og desktop-appens auto-update-check.
//
// GET /api/public/latest-version
// -> { version, filename, size, url, releasedAt, changelog }
export const Route = createFileRoute("/api/public/latest-version")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const absoluteUrl = DOWNLOAD_PATH.startsWith("http")
          ? DOWNLOAD_PATH
          : `${origin}${DOWNLOAD_PATH}`;

        return Response.json(
          {
            version: APP_VERSION.latest,
            filename: APP_VERSION.filename,
            fileSize: APP_VERSION.fileSize,
            releasedAt: APP_VERSION.released,
            supportedOs: APP_VERSION.supportedOs,
            url: absoluteUrl,
            changelog: CHANGELOG,
          },
          {
            headers: {
              "cache-control": "public, max-age=300",
              "access-control-allow-origin": "*",
            },
          },
        );
      },
    },
  },
});
