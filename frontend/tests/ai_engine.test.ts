import test from "node:test";
import assert from "node:assert/strict";
import {
  SpellCheckTrie,
  LRUCache,
  formatConversationalFlow,
  polishMessageLocally,
} from "../src/services/ai-engine";

test("SpellCheckTrie exact search and edit-distance lookup", () => {
  const trie = new SpellCheckTrie();
  trie.insert("everything", "everything");
  trie.insert("everyhing", "everything");
  trie.insert("tomorrow", "tomorrow");

  assert.equal(trie.search("everyhing"), "everything");
  assert.equal(trie.search("everything"), "everything");
  assert.equal(trie.getClosestMatch("everyhting", 2), "everything");
  assert.equal(trie.getClosestMatch("tommorow", 2), "tomorrow");
});

test("LRUCache O(1) eviction and lookup", () => {
  const cache = new LRUCache<string, string>(2);
  cache.put("a", "1");
  cache.put("b", "2");
  assert.equal(cache.get("a"), "1"); // accesses 'a', makes 'b' LRU
  cache.put("c", "3"); // should evict 'b'
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), "1");
  assert.equal(cache.get("c"), "3");
});

test("formatConversationalFlow normalizes run-on clauses into proper questions and sentences", () => {
  const input =
    "hi how are you what are you doing is everything going well. Please let me know your thoughts when convenient.";
  const expected =
    "Hi, how are you? What are you doing? Is everything going well? Please let me know your thoughts when convenient.";
  assert.equal(formatConversationalFlow(input), expected);
});

test("polishMessageLocally fixes typos, flow, and punct in Auto-Polish", () => {
  const input =
    "hi how are you what are you doing is everyhing going well. Please let me know your thoughts when convenient.";
  const expected =
    "Hi, how are you? What are you doing? Is everything going well? Please let me know your thoughts when convenient.";
  const result = polishMessageLocally(input, "polish");
  assert.equal(result, expected);
});

test("polishMessageLocally never prepends custom instruction to draft", () => {
  const draft = "Hi how are you what are you doing is everyhing going well.";
  const instruction = "Turn this into a warm, loving message for my best friend.";
  const result = polishMessageLocally(draft, "custom", instruction);

  assert.equal(result.startsWith(instruction), false);
  assert.equal(result.includes(`${instruction}:`), false);
  assert.equal(result.toLowerCase().includes("friendship"), true);
});

test("polishMessageLocally handles custom convert when draft is empty", () => {
  const instruction = "Draft a warm message for my best friend";
  const result = polishMessageLocally("", "custom", instruction);

  assert.equal(result.startsWith(instruction), false);
  assert.ok(result.length > 10);
});

test("polishMessageLocally supports all tone presets", () => {
  const draft = "hi how are you is everything going well";

  // 1. Professional
  const prof = polishMessageLocally(draft, "professional");
  assert.ok(prof.includes("Hello") || prof.includes("Dear"));

  // 2. Concise
  const concise = polishMessageLocally(draft, "concise");
  assert.equal(concise.toLowerCase().includes("how are you"), false);

  // 3. Friendly
  const friendly = polishMessageLocally("please review the report", "friendly");
  assert.ok(friendly.startsWith("Hi!"));

  // 4. Action / CTA
  const action = polishMessageLocally("here is the update", "action");
  assert.ok(action.includes("Please let me know your thoughts when convenient."));
});

