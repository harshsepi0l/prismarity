"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { c } from "../../../theme-colors";

export interface RichInputHandle {
  insertEmote(code: string, url: string): void;
  acceptShortcode(code: string, url: string): void;
  insertMention(handle: string): void;
  clear(): void;
  restore(text: string): void;
  focus(): void;
}

interface Props {
  emotes: Record<string, string>;
  placeholder?: string;
  disabled?: boolean;
  onChange: (text: string) => void;
  onBeforeCursor: (text: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  onSubmit?: () => void;
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function extractText(root: Node): string {
  let out = "";
  for (const n of root.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      // Normalize the non-breaking space we place after an emote (it keeps the
      // caret from stranding on a collapsed trailing space) back to a plain
      // space for the outgoing message.
      out += (n.textContent ?? "").replace(/\u00A0/g, " ");
    } else if (n instanceof HTMLImageElement && n.dataset.emote) {
      out += n.dataset.emote;
    } else if (n instanceof HTMLBRElement) {
      // ignore
    } else {
      out += extractText(n);
    }
  }
  return out;
}

function getTextBeforeCaret(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return extractText(root);
  const r = document.createRange();
  r.selectNodeContents(root);
  const caret = sel.getRangeAt(0);
  r.setEnd(caret.startContainer, caret.startOffset);
  const tmp = document.createElement("div");
  tmp.appendChild(r.cloneContents());
  return extractText(tmp);
}

function makeImg(code: string, url: string): HTMLImageElement {
  const img = document.createElement("img");
  img.src = url;
  img.alt = code;
  img.dataset.emote = code;
  img.style.cssText =
    "height:22px;display:inline-block;vertical-align:middle;margin:0 2px;pointer-events:none";
  return img;
}

// Replace [start, end) in textNode with emote img + a trailing space text node.
// Returns the space node so the caller can put the caret at its end.
function spliceEmote(
  textNode: Text,
  start: number,
  end: number,
  code: string,
  url: string,
): Text {
  const full = textNode.textContent ?? "";
  const before = full.slice(0, start);
  const after = full.slice(end);
  const parent = textNode.parentNode!;

  textNode.textContent = before;

  const img = makeImg(code, url);
  const space = document.createTextNode("\u00A0");

  parent.insertBefore(img, textNode.nextSibling);
  parent.insertBefore(space, img.nextSibling);
  if (after) parent.insertBefore(document.createTextNode(after), space.nextSibling);

  return space;
}

function putCaretAtEnd(node: Text) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.setStart(node, node.length);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

// ── Component ──────────────────────────────────────────────────────────────

export const RichInput = forwardRef<RichInputHandle, Props>(function RichInput(
  { emotes, placeholder, disabled, onChange, onBeforeCursor, onKeyDown, onSubmit },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const emotesRef = useRef(emotes);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    emotesRef.current = emotes;
  }, [emotes]);

  function notify(el: HTMLElement) {
    const t = extractText(el);
    setEmpty(t.length === 0);
    onChange(t);
    onBeforeCursor(getTextBeforeCaret(el));
  }

  // Locate the text node + offset directly before the caret, handling both
  // "caret inside text node" and "caret inside element node" placements that
  // different browsers use for contenteditable.
  function getCaretTextPosition(): { tn: Text; offset: number } | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const caret = sel.getRangeAt(0);

    if (caret.startContainer.nodeType === Node.TEXT_NODE) {
      return { tn: caret.startContainer as Text, offset: caret.startOffset };
    }

    // Caret is placed in an element node — look at the child just before it.
    const elem = caret.startContainer;
    const prev = elem.childNodes[caret.startOffset - 1];
    if (prev && prev.nodeType === Node.TEXT_NODE) {
      return { tn: prev as Text, offset: (prev as Text).length };
    }
    return null;
  }

  // Check whether the word immediately before the caret is a known emote.
  // If so, replace it with an inline img and return true. Called on space keydown
  // (before the browser inserts the character) so the DOM is in a clean state.
  function tryConvertWordBeforeCaret(): boolean {
    const el = editorRef.current;
    if (!el) return false;
    const pos = getCaretTextPosition();
    if (!pos) return false;

    const { tn, offset } = pos;
    const textBefore = tn.textContent?.slice(0, offset) ?? "";
    const m = textBefore.match(/(\S+)$/);
    if (!m) return false;

    const code = m[1];
    const url = emotesRef.current[code];
    if (!url) return false;

    const wordStart = offset - code.length;
    const space = spliceEmote(tn, wordStart, offset, code, url);
    putCaretAtEnd(space);
    notify(el);
    return true;
  }

  // ── Imperative handle ────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    insertEmote(code, url) {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const img = makeImg(code, url);
      const space = document.createTextNode("\u00A0");
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(space);
        range.insertNode(img);
      } else {
        el.appendChild(img);
        el.appendChild(space);
      }
      putCaretAtEnd(space);
      notify(el);
    },

    acceptShortcode(code, url) {
      const el = editorRef.current;
      if (!el) return;
      const pos = getCaretTextPosition();
      if (!pos) return;

      const { tn, offset } = pos;
      const beforeCursor = tn.textContent?.slice(0, offset) ?? "";
      const m = beforeCursor.match(/:(\w+)$/);
      if (!m) return;

      const colonStart = offset - m[0].length;
      const space = spliceEmote(tn, colonStart, offset, code, url);
      putCaretAtEnd(space);
      notify(el);
    },

    // Replace the "@partial" immediately before the caret with "@handle " as
    // plain text (mentions are sent verbatim — no inline chip). Keeps focus.
    insertMention(handle) {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const pos = getCaretTextPosition();
      if (!pos) return;

      const { tn, offset } = pos;
      const before = tn.textContent?.slice(0, offset) ?? "";
      // [\w-] so hyphenated Kick slugs survive; kept in sync with the composer's
      // detection regex.
      const m = before.match(/@([\w-]*)$/);
      if (!m) return;

      const start = offset - m[0].length;
      const insert = `@${handle} `;
      const full = tn.textContent ?? "";
      tn.textContent = full.slice(0, start) + insert + full.slice(offset);

      const caret = start + insert.length;
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.setStart(tn, Math.min(caret, tn.length));
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      notify(el);
    },

    clear() {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = "";
      setEmpty(true);
      onChange("");
      onBeforeCursor("");
    },

    // Put text back into a cleared editor (e.g. a send failed) and refocus so
    // the user can immediately retry.
    restore(text) {
      const el = editorRef.current;
      if (!el) return;
      el.innerHTML = "";
      if (text) {
        const tn = document.createTextNode(text);
        el.appendChild(tn);
        putCaretAtEnd(tn);
      }
      el.focus();
      setEmpty(text.length === 0);
      onChange(text);
      onBeforeCursor(text);
    },

    focus() {
      editorRef.current?.focus();
    },
  }));

  // ── Event handlers ────────────────────────────────────────────────────────

  // onInput only handles structural cleanup + state sync. Emote conversion
  // happens in onKeyDown (before the space character is inserted) because
  // keydown gives a reliable, pre-mutation DOM state and caret position.
  function handleInput(e: FormEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    // Flatten block elements some browsers inject when editing
    if (el.querySelector("div, p")) {
      const flat = extractText(el);
      el.innerHTML = "";
      if (flat) {
        const tn = document.createTextNode(flat);
        el.appendChild(tn);
        putCaretAtEnd(tn);
      }
    }
    // Remove stray <br> elements browsers add to empty contenteditable
    el.querySelectorAll("br").forEach((br) => br.remove());
    notify(el);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Let the parent intercept first (shortcode navigation, etc.).
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === " ") {
      // Convert "EMOTEWORD<space>" → inline emote. preventDefault stops the
      // browser from inserting the space (spliceEmote already adds one).
      if (tryConvertWordBeforeCaret()) {
        e.preventDefault();
        return;
      }
    }

    // isComposing: don't submit while an IME candidate is being composed
    // (Enter confirms the candidate, it shouldn't send the message).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit?.();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\r?\n/g, " ");
    if (!text) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const tn = document.createTextNode(text);
      range.insertNode(tn);
      putCaretAtEnd(tn);
    }
    if (editorRef.current) notify(editorRef.current);
  }

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        style={{
          outline: "none",
          minHeight: 22,
          fontSize: 14,
          color: "inherit",
          lineHeight: "22px",
          wordBreak: "break-word",
        }}
      />
      {empty && placeholder && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            color: c.muted,
            fontSize: 14,
            lineHeight: "22px",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {placeholder}
        </span>
      )}
    </div>
  );
});
