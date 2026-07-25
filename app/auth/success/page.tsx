"use client";

import { useEffect } from "react";

export default function AuthSuccess() {
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    try {
      window.opener?.postMessage(
        error
          ? { type: "prismarity_auth_error", reason: error }
          : { type: "prismarity_auth_success" },
        window.location.origin
      );
    } catch {
      // opener may have gone away
    }
    window.close();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--chakra-colors-bg)",
        color: "var(--chakra-colors-muted)",
        fontFamily: "var(--font-rounded), ui-rounded, system-ui, sans-serif",
        fontSize: "14px",
      }}
    >
      Authenticated. Closing…
    </div>
  );
}
