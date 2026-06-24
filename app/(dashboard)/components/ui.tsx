import { Box, Text } from "@chakra-ui/react";

// Shared presentational helpers for the dashboard screens.

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text fontFamily="mono" fontSize="10px" letterSpacing="0.18em" color="faint">
      {children}
    </Text>
  );
}

export function Divider({ my = "24px" }: { my?: string }) {
  return <Box h="1px" bg="line" my={my} />;
}

export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Box mb="24px">
      <Text as="h1" fontFamily="heading" fontWeight="600" fontSize="22px" color="text">
        {title}
      </Text>
      <Text mt="7px" fontSize="14px" color="muted">
        {subtitle}
      </Text>
    </Box>
  );
}

// Diagonal hatch fill used for placeholder avatars/thumbnails.
export const HATCH = "repeating-linear-gradient(135deg,#1F2532 0 6px,#171B26 6px 12px)";
