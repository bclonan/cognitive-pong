type ClipboardEnvironment = {
  navigator?: {
    clipboard?: {
      writeText?: (text: string) => Promise<void>;
    };
  };
  document?: {
    body?: {
      appendChild?: (node: any) => void;
    };
    createElement?: (tagName: string) => any;
    execCommand?: (command: string) => boolean;
  };
};

const defaultClipboardEnvironment = (): ClipboardEnvironment => ({
  navigator: typeof navigator !== "undefined" ? navigator : undefined,
  document: typeof document !== "undefined" ? document : undefined,
});

export async function copyTextToClipboard(
  text: string,
  env: ClipboardEnvironment = defaultClipboardEnvironment()
) {
  try {
    if (env.navigator?.clipboard?.writeText) {
      await env.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the selection path below when browser permissions block Clipboard API.
  }

  const doc = env.document;
  if (!doc?.createElement || !doc.body?.appendChild || !doc.execCommand) {
    return false;
  }

  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute?.("readonly", "true");
  if (textarea.style) {
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
  }

  doc.body.appendChild(textarea);
  textarea.focus?.();
  textarea.select?.();

  try {
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove?.();
  }
}
