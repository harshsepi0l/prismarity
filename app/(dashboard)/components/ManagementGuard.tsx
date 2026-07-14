"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "../_ctx/chat";

// Management surfaces (Loyalty, VODs) are only for the active channel's
// creator/moderator. Viewers (or no channel selected) get redirected to chat.
export function ManagementGuard({ children }: { children: React.ReactNode }) {
  const { activeRole } = useChat();
  const router = useRouter();
  const allowed = activeRole === "creator" || activeRole === "moderator";

  useEffect(() => {
    if (!allowed) router.replace("/chat");
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
