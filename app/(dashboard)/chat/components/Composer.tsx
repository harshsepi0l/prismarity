"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { RichInput, type RichInputHandle } from "./RichInput";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { useChat, type MentionCandidate } from "../../_ctx/chat";
import { useEmotes, useEmoteCategories } from "../../_ctx/emotes";
import { useSession } from "../../_ctx/session";
import { useStats } from "../../_ctx/stats";
import { PLATFORM_LABEL } from "../../components/PlatformIcon";
import type { Platform } from "../../types";
import { useChatSend, FOLLOWER_ONLY_MESSAGE } from "./composer/useChatSend";
import EmotePicker from "./composer/EmotePicker";
import EmoteAutocomplete from "./composer/EmoteAutocomplete";
import MentionAutocomplete from "./composer/MentionAutocomplete";
import SendTargets from "./composer/SendTargets";
import { alpha, PLATFORM } from "../../../theme-colors";

export default function Composer() {
  const { activeChannel, activeKick, activeKickOnly, activeYouTube, ownYouTube, getMentionCandidates, liveByPlatform } = useChat();
  const emotes = useEmotes();
  const categories = useEmoteCategories();
  const { sendTargets, toggleSendTarget } = useSession();
  const { platforms } = useStats(); // per-platform chat-mode (follower minutes)

  const { sending, error, errorPlatform, followCountdown, startFollowCountdown, send, clearError } =
    useChatSend();

  // The name shown in placeholders/status — Twitch channel, else the Kick slug,
  // else your own YouTube channel when it's the standalone selection.
  const channelName =
    activeChannel?.displayName ??
    activeKick?.slug ??
    activeKickOnly ??
    (activeYouTube?.own ? ownYouTube?.channelName ?? "your channel" : null);

  const richInputRef = useRef<RichInputHandle>(null);
  const [text, setText] = useState("");
  const [textBeforeCursor, setTextBeforeCursor] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // The platforms you can send to for the active selection: Twitch when a channel
  // is selected, Kick when one is linked — but only where the streamer is LIVE
  // (per the match). We don't send to a platform where they're offline.
  const available: Platform[] = [];
  if (activeChannel && liveByPlatform.twitch) available.push("twitch");
  if (activeKick && liveByPlatform.kick) available.push("kick");
  // YouTube: send to whatever live chat we're reading — the own broadcast, or a
  // tuned streamer's simulcast once its send target (liveChatId) resolved (which
  // needs YouTube connected). A tuned chat without a liveChatId stays read-only.
  const youtubeSendable = !!activeYouTube && (activeYouTube.own || !!activeYouTube.liveChatId);
  if (youtubeSendable && liveByPlatform.youtube) available.push("youtube");
  // Armed targets among the available platforms; default is all-on.
  const deliverable = available.filter((p) => sendTargets.has(p));
  // (Offline platforms are excluded from `available` above, so nothing armed is
  // ever offline — kept for the SendTargets warning contract.)
  const offlineTargets = deliverable.filter((p) => liveByPlatform[p] === false);

  // Identifies the active channel selection — used to reset transient composer
  // state on switch, and to guard the async restore-on-failure below.
  const selectionKey = activeChannel?.id ?? activeKick?.slug ?? activeKickOnly ?? (activeYouTube?.own ? "youtube-own" : null);
  const selectionKeyRef = useRef(selectionKey);

  // ── emote ":shortcode" autocomplete ──────────────────────
  const [dismissedShortcode, setDismissedShortcode] = useState<string | null>(null);
  const [selectedSuggIdx, setSelectedSuggIdx] = useState(0);

  // Twitch emotes (7TV/BTTV/FFZ/channel) are only relevant when Twitch is a send
  // target. If only Kick is targeted, we have no Kick-specific emotes to offer.
  const showTwitchEmotes = sendTargets.has("twitch");

  // Detect ":word" immediately before the caret (not end of full text, since the
  // caret might not be at the end with a rich input).
  const shortcodeQuery = textBeforeCursor.match(/:(\w+)$/)?.[1]?.toLowerCase() ?? null;
  const shortcodeSuggestions = useMemo(() => {
    if (!showTwitchEmotes || !shortcodeQuery || shortcodeQuery === dismissedShortcode || pickerOpen)
      return [];
    return Object.entries(emotes)
      .filter(([code]) => code.toLowerCase().startsWith(shortcodeQuery))
      .slice(0, 8);
  }, [emotes, shortcodeQuery, dismissedShortcode, pickerOpen, showTwitchEmotes]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedSuggIdx(0); }, [shortcodeQuery]);

  // ── "@mention" autocomplete ──────────────────────────────
  const [dismissedMention, setDismissedMention] = useState<string | null>(null);
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);

  // Detect "@word" before the caret: boundary-guarded (start or whitespace) so it
  // never fires mid-token (e.g. an email), and [\w-] so hyphenated Kick slugs
  // match. Empty query (bare "@") is allowed — it lists recent chatters.
  const mentionQuery = textBeforeCursor.match(/(?:^|\s)@([\w-]*)$/)?.[1] ?? null;
  const mentionSuggestions = useMemo<MentionCandidate[]>(() => {
    // Mutually exclusive with the emote popover (a caret can't be preceded by
    // both a ":word" and an "@word" run), but guard defensively anyway.
    if (mentionQuery == null || mentionQuery === dismissedMention || pickerOpen) return [];
    if (shortcodeSuggestions.length > 0 || deliverable.length === 0) return [];
    return getMentionCandidates(mentionQuery, deliverable, 6);
  }, [mentionQuery, dismissedMention, pickerOpen, shortcodeSuggestions.length, deliverable, getMentionCandidates]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedMentionIdx(0); }, [mentionQuery]);

  // Clear input + reset transient state whenever the active channel changes, and
  // keep selectionKeyRef current for the async restore-on-failure guard below.
  useEffect(() => {
    selectionKeyRef.current = selectionKey;
    richInputRef.current?.clear();
    clearError();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPickerOpen(false);
    setDismissedShortcode(null);
    setDismissedMention(null);
  }, [selectionKey, clearError]);

  function acceptShortcode(code: string, url: string) {
    richInputRef.current?.acceptShortcode(code, url);
    setDismissedShortcode(null);
  }

  function acceptMention(c: MentionCandidate) {
    richInputRef.current?.insertMention(c.user);
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (shortcodeSuggestions.length > 0) {
      const len = shortcodeSuggestions.length;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedSuggIdx((i) => (i + 1) % len);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedSuggIdx((i) => (i - 1 + len) % len);
      } else if (e.key === "Tab" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const [code, url] = shortcodeSuggestions[selectedSuggIdx];
        acceptShortcode(code, url);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDismissedShortcode(shortcodeQuery);
      }
      return;
    }
    if (mentionSuggestions.length > 0) {
      const len = mentionSuggestions.length;
      // Vertical list: ↑/↓ navigate; ←/→ stay free for editing the @partial.
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIdx((i) => (i + 1) % len);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIdx((i) => (i - 1 + len) % len);
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        acceptMention(mentionSuggestions[selectedMentionIdx]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDismissedMention(mentionQuery);
      }
    }
  }

  async function doSend() {
    const message = text.trim();
    if (!message || sending || deliverable.length === 0) return;

    // Optimistic: clear + keep focus the instant we send (the self-message is
    // added to the feed at the same moment), rather than waiting on the network.
    const keyAtSend = selectionKeyRef.current;
    richInputRef.current?.clear();
    richInputRef.current?.focus();
    setPickerOpen(false);

    const ok = await send(message, deliverable);
    // Restore the text so it can be retried — but only if we're still on the same
    // channel (a slow failure shouldn't dump old text into a channel we switched to).
    if (!ok && selectionKeyRef.current === keyAtSend) {
      richInputRef.current?.restore(message);
    }
  }

  const canSend = deliverable.length > 0 && !!text.trim() && !sending;

  // Reactive follow link — shown only after a failed send proves the user isn't
  // following. No proactive API checks; the failure is the only reliable signal.
  const isFollowerError = error === FOLLOWER_ONLY_MESSAGE;
  const reactiveFollowLink = isFollowerError
    ? errorPlatform === "twitch"
      ? `https://twitch.tv/${activeChannel?.login ?? ""}`
      : errorPlatform === "kick"
        ? `https://kick.com/${activeKick?.slug ?? ""}`
        : null
    : null;
  const twitchFollowerMinutes =
    platforms.find((p) => p.platform === "twitch")?.chatMode?.followerMinutes ?? 0;
  const kickFollowerMinutes =
    platforms.find((p) => p.platform === "kick")?.chatMode?.followerMinutes ?? 0;

  return (
    <Box flex="none" px={{ base: "12px", md: "24px" }} pt="16px" pb="22px">
      <Box position="relative">
        <EmotePicker
          open={pickerOpen}
          categories={categories}
          onInsert={(code, url) => richInputRef.current?.insertEmote(code, url)}
        />

        <EmoteAutocomplete
          items={shortcodeSuggestions}
          selectedIdx={selectedSuggIdx}
          onPick={acceptShortcode}
        />

        <MentionAutocomplete
          items={mentionSuggestions}
          selectedIdx={selectedMentionIdx}
          onPick={acceptMention}
        />

        <Flex
          as="form"
          align="center"
          gap="10px"
          bg="field"
          borderWidth="1px"
          borderColor="fieldLine"
          borderRadius="10px"
          pl="16px"
          pr="6px"
          py="6px"
          onSubmit={(e) => { e.preventDefault(); void doSend(); }}
        >
          <RichInput
            ref={richInputRef}
            emotes={emotes}
            placeholder={channelName ? `Message ${channelName}…` : "Select a channel to chat"}
            onChange={setText}
            onBeforeCursor={setTextBeforeCursor}
            onKeyDown={handleComposerKeyDown}
            onSubmit={() => { void doSend(); }}
          />

          <chakra.button
            type="button"
            onClick={() => showTwitchEmotes && setPickerOpen((v) => !v)}
            title={showTwitchEmotes ? "Emotes" : "Emotes (select Twitch to use)"}
            aria-label="Emotes"
            display="flex"
            alignItems="center"
            justifyContent="center"
            h="32px"
            w="32px"
            borderRadius="7px"
            color={pickerOpen ? "text" : "muted"}
            cursor={showTwitchEmotes ? "pointer" : "not-allowed"}
            opacity={showTwitchEmotes ? 1 : 0.35}
            transition="background .12s, color .12s, opacity .12s"
            _hover={{ bg: showTwitchEmotes ? "raised" : "transparent", color: showTwitchEmotes ? "text" : "muted" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7.3" cy="8.3" r="1" fill="currentColor" />
              <circle cx="12.7" cy="8.3" r="1" fill="currentColor" />
              <path
                d="M6.8 12 C8 13.6 12 13.6 13.2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </chakra.button>

          <chakra.button
            type="submit"
            flex="none"
            disabled={!canSend}
            suppressHydrationWarning
            bg="accent"
            fontWeight="600"
            fontSize="14px"
            px="20px"
            py="9px"
            borderRadius="7px"
            color="accentText"
            cursor={canSend ? "pointer" : "not-allowed"}
            opacity={canSend ? 1 : 0.5}
            transition="filter .12s, opacity .12s"
            _hover={{ filter: canSend ? "brightness(1.08)" : "none" }}
          >
            {sending ? "…" : "Send"}
          </chakra.button>
        </Flex>
      </Box>

      <Flex mt="10px" align="center" gap="12px" wrap="wrap" rowGap="6px">
        <SendTargets
          available={available}
          sendTargets={sendTargets}
          toggleSendTarget={toggleSendTarget}
          liveByPlatform={liveByPlatform}
        />

        {offlineTargets.length > 0 ? (
          <Flex align="center" gap="6px" title="Both Twitch and Kick allow chatting while a channel is offline.">
            <Box w="6px" h="6px" borderRadius="full" bg="#F5A623" flex="none" />
            <Text fontFamily="mono" fontSize="10px" letterSpacing="0.04em" color="#F5A623">
              {`Posting to offline chat on ${offlineTargets
                .map((p) => PLATFORM_LABEL[p])
                .join(" & ")}`}
            </Text>
          </Flex>
        ) : (
          <Text hideBelow="md" fontFamily="mono" fontSize="10px" letterSpacing="0.04em" color="faint">
            {"Show or hide a chat from its header above."}
          </Text>
        )}

        {error ? (
          <Flex align="center" gap="8px" ml="auto">
            <Text fontFamily="mono" fontSize="10px" letterSpacing="0.04em" color="#FF5C5C">
              {error}
            </Text>
            {reactiveFollowLink && (
              <chakra.a
                href={reactiveFollowLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  const mins = errorPlatform === "twitch" ? twitchFollowerMinutes : kickFollowerMinutes;
                  startFollowCountdown(Math.max(15, mins > 0 ? mins * 60 : errorPlatform === "twitch" ? 60 : 15));
                }}
                px="8px"
                py="2px"
                borderRadius="5px"
                fontSize="10px"
                fontWeight="600"
                bg={errorPlatform === "twitch" ? "#A66CFF22" : "#5BE37D22"}
                color={errorPlatform === "twitch" ? "twitch" : "kick"}
                borderWidth="1px"
                borderColor={errorPlatform === "twitch" ? "#A66CFF44" : "#5BE37D44"}
                flex="none"
                transition="background .12s"
                _hover={{ bg: errorPlatform === "twitch" ? "#A66CFF33" : "#5BE37D33" }}
              >
                Follow
              </chakra.a>
            )}
          </Flex>
        ) : (
          <Text ml="auto" fontFamily="mono" fontSize="10px" letterSpacing="0.04em" color="faint">
            {channelName ? `Chatting in ${channelName}` : "Select a channel to start chatting."}
          </Text>
        )}
      </Flex>

      {/* Follow countdown — shown after clicking Follow from a reactive error */}
      {followCountdown !== null && (
        <Flex
          align="center"
          gap="8px"
          mt="8px"
          px="12px"
          py="7px"
          borderRadius="8px"
          bg={errorPlatform === "twitch" ? alpha(PLATFORM.twitch, 0.1) : alpha(PLATFORM.kick, 0.1)}
          borderWidth="1px"
          borderColor={errorPlatform === "twitch" ? "#A66CFF44" : "#5BE37D44"}
        >
          <Box
            w="6px" h="6px" flex="none" borderRadius="full"
            bg={errorPlatform === "twitch" ? "twitch" : "kick"}
            style={{ animation: "pris-pulse 1s ease-in-out infinite" }}
          />
          <Text fontSize="12px" color="muted" flex="1">
            {"Follow registered — try sending again in "}
            <Text as="span" color={errorPlatform === "twitch" ? "twitch" : "kick"} fontWeight="600">
              {followCountdown}s
            </Text>
          </Text>
        </Flex>
      )}
    </Box>
  );
}
