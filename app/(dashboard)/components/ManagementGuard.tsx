"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "../useChat";

// Management surfaces (Loyalty, VODs) are only for the active channel's
// creator/moderator. Viewers (or no channel selected) get redirected to chat.
export function ManagementGuard({ children }: { children: React.ReactNode }) {
  const { activeChannel } = useChat();
  const router = useRouter();
  const role = activeChannel?.role ?? "viewer";
  const allowed = role === "creator" || role === "moderator";

  useEffect(() => {
    if (!allowed) router.replace("/chat");
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
