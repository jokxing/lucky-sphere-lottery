export async function copyToClipboard(text: string): Promise<void> {
  const t = String(text ?? "");
  if (!t) throw new Error("empty_text");

  // Modern API (requires secure context in most browsers)
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      // Some browsers allow in insecure contexts, some don't; try anyway first.
      await navigator.clipboard.writeText(t);
      return;
    }
  } catch {
    // fallback below
  }

  // Fallback: document.execCommand('copy') (works in many mobile browsers / webviews)
  if (typeof document === "undefined") throw new Error("no_document");
  const ta = document.createElement("textarea");
  ta.value = t;
  ta.setAttribute("readonly", "true");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  ta.style.pointerEvents = "none";
  ta.style.width = "1px";
  ta.style.height = "1px";
  document.body.appendChild(ta);

  try {
    ta.focus({ preventScroll: true } as any);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("execCommand_failed");
  } finally {
    document.body.removeChild(ta);
  }
}


