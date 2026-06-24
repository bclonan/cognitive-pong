import assert from "node:assert/strict";
import test from "node:test";
import { copyTextToClipboard } from "../src/utils/clipboard";

function createFakeDocument(execResult: boolean) {
  const created: any[] = [];
  const appended: any[] = [];
  return {
    created,
    appended,
    document: {
      body: {
        appendChild: (node: any) => appended.push(node),
      },
      createElement: (tagName: string) => {
        const node = {
          tagName,
          value: "",
          style: {},
          removed: false,
          focused: false,
          selected: false,
          setAttribute(name: string, value: string) {
            this[name] = value;
          },
          focus() {
            this.focused = true;
          },
          select() {
            this.selected = true;
          },
          remove() {
            this.removed = true;
          },
        };
        created.push(node);
        return node;
      },
      execCommand: (command: string) => command === "copy" && execResult,
    },
  };
}

test("copyTextToClipboard uses Clipboard API when permission allows", async () => {
  let copiedText = "";
  const didCopy = await copyTextToClipboard("ollama run llama3", {
    navigator: {
      clipboard: {
        writeText: async (text) => {
          copiedText = text;
        },
      },
    },
  });

  assert.equal(didCopy, true);
  assert.equal(copiedText, "ollama run llama3");
});

test("copyTextToClipboard falls back to selection copy when Clipboard API is blocked", async () => {
  const fake = createFakeDocument(true);
  const didCopy = await copyTextToClipboard(`OLLAMA_ORIGINS="*" ollama serve`, {
    navigator: {
      clipboard: {
        writeText: async () => {
          throw new Error("permission denied");
        },
      },
    },
    document: fake.document,
  });

  assert.equal(didCopy, true);
  assert.equal(fake.created[0].value, `OLLAMA_ORIGINS="*" ollama serve`);
  assert.equal(fake.created[0].focused, true);
  assert.equal(fake.created[0].selected, true);
  assert.equal(fake.created[0].removed, true);
  assert.equal(fake.appended.length, 1);
});

test("copyTextToClipboard reports denial when both clipboard strategies fail", async () => {
  const fake = createFakeDocument(false);
  const didCopy = await copyTextToClipboard("npx localtunnel --port 8787", {
    navigator: {
      clipboard: {
        writeText: async () => {
          throw new Error("permission denied");
        },
      },
    },
    document: fake.document,
  });

  assert.equal(didCopy, false);
  assert.equal(fake.created[0].removed, true);
});
