import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/guest-chat")({
  server: { handlers: { POST: async ({ request }) => {
    const { guestChatResponse } = await import("@/lib/guest-chat.server");
    return guestChatResponse(request);
  } } },
});