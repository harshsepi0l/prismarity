"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme";
import { EmotionRegistry } from "./emotion-registry";
import { ColorModeProvider } from "./_ctx/color-mode";

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <EmotionRegistry>
      <ChakraProvider value={system}>
        <ColorModeProvider>{children}</ColorModeProvider>
      </ChakraProvider>
    </EmotionRegistry>
  );
}
