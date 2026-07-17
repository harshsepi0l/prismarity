"use client";

// Emotion + Next.js App Router SSR fix.
//
// Without this, Emotion generates class names on the server and inserts them
// into <style> tags, but the client re-generates them independently. The class
// name counter or insertion order can differ, producing a "attributes of the
// server rendered HTML didn't match the client properties" hydration warning.
//
// This registry extracts the Emotion CSS generated during SSR via React 18's
// useServerInsertedHTML hook and injects it into <head> before hydration, so
// the client can skip regenerating those rules and the class names stay in sync.

import { useState } from "react";
import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";
import { CacheProvider } from "@emotion/react";

export function EmotionRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "css" });
    cache.compat = true;
    const prevInsert = cache.insert.bind(cache);
    let inserted: string[] = [];

    cache.insert = (...args) => {
      const [, serialized] = args;
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };

    return {
      cache,
      flush() {
        const names = inserted;
        inserted = [];
        return names;
      },
    };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    const styles = names
      .map((name) => cache.inserted[name] as string | undefined)
      .filter(Boolean)
      .join("");
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
