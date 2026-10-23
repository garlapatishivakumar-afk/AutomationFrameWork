"use strict";

// Current metadata records a rewrite ONLY through a non-empty actions[].locator.
// confidence/uniqueMatch/tableDetected/analyzedActions are not rewrite flags.
function isTransformed(entry) {
  return !!entry && typeof entry.locator === "string" && !!entry.locator.trim();
}

// Small non-executing tokenizer: normalizes quote style and syntax whitespace,
// but preserves whitespace inside string values ("New York" != "NewYork").
function tokens(text, comments = true, state = {}, keepSpaces = false) {
  const result = [];
  for (let i = 0; i < text.length;) {
    if (comments && state.blockComment) {
      const end = text.indexOf("*/", i);
      if (end < 0) return result;
      state.blockComment = false; i = end + 2; continue;
    }
    if (/\s/.test(text[i])) {
      if (keepSpaces && result.at(-1)?.kind !== "space") result.push({ kind: "space", value: " " });
      i++; continue;
    }
    if (comments && text.slice(i, i + 2) === "//") {
      result.push({ kind: "comment", value: text.slice(i) }); break;
    }
    if (comments && text.slice(i, i + 2) === "/*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) { state.blockComment = true; return result; }
      i = end + 2; continue;
    }
    const quote = text[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      let value = "", closed = false;
      i++;
      while (i < text.length) {
        const char = text[i++];
        if (char === quote) { closed = true; break; }
        if (quote === "`" && char === "$" && text[i] === "{") return [];
        if (char !== "\\") { value += char; continue; }
        if (i >= text.length) return [];
        const escaped = text[i++];
        const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" };
        if (escaped === "u" || escaped === "x") {
          const count = escaped === "u" ? 4 : 2;
          const hex = text.slice(i, i + count);
          if (!new RegExp(`^[0-9a-fA-F]{${count}}$`).test(hex)) return [];
          value += String.fromCharCode(parseInt(hex, 16)); i += count;
        } else value += simple[escaped] ?? escaped;
      }
      if (!closed) return [];
      result.push({ kind: "string", value }); continue;
    }
    const word = /^[\w$-]+/.exec(text.slice(i));
    if (word) { result.push({ kind: "word", value: word[0] }); i += word[0].length; }
    else { result.push({ kind: "symbol", value: text[i++] }); }
  }
  return result;
}

function normalizeSelector(selector) {
  const xpath = /^(?:xpath=)?(?:\.?\/|\()/.test(selector.trim());
  const parsed = tokens(selector.trim(), false, {}, !xpath);
  // CSS descendant whitespace is semantic: '.a .b' is not '.a.b'. XPath
  // syntactic spacing can be ignored, but string-literal content never is.
  const normalized = parsed.filter((token, i) => token.kind !== "space" ||
    ![parsed[i - 1], parsed[i + 1]].some((neighbor) => neighbor?.kind === "symbol" && /[\[\]()=,>+~]/.test(neighbor.value)));
  return normalized.length ? JSON.stringify(normalized) : null;
}

function lineMatches(parts, entry) {
  if (parts[0]?.value !== "await" || parts[0]?.kind !== "word") return false;
  for (let i = 1; i < parts.length - 7; i++) {
    // Match the terminal locator receiver, never a fill value, comment or scope.
    if (parts[i].value === "." && parts[i + 1].value === "locator" && parts[i + 2].value === "(" &&
        parts[i + 3].kind === "string" && parts[i + 4].value === ")" && parts[i + 5].value === "." &&
        /^(click|dblclick|hover|check|uncheck|fill|press|selectOption|setInputFiles|focus|waitFor)$/.test(parts[i + 6].value) &&
        parts[i + 7].value === "(" && (!entry.action || entry.action === parts[i + 6].value) &&
        normalizeSelector(entry.locator) !== null &&
        normalizeSelector(parts[i + 3].value) === normalizeSelector(entry.locator)) return true;
  }
  return false;
}

// Returned line numbers are 1-based, like metadata.line. sourceLine is not the
// merged file line: it is only used for per-case provenance and C# tooltip lookup.
function findTsHighlights(metadata, textLines) {
  const entries = Array.isArray(metadata?.actions) ? metadata.actions : [];
  const state = {};
  const parsedLines = textLines.map((line) => tokens(line, true, state));
  let caseId;
  const caseIds = parsedLines.map((parts) => {
    if (parts[0]?.value === "test" && parts[1]?.value === "(" && parts[2]?.kind === "string")
      caseId = /^([A-Za-z0-9_-]+) - /.exec(parts[2].value)?.[1];
    return caseId;
  });
  const highlighted = new Set(), result = [];
  for (const entry of entries) {
    if (!isTransformed(entry) || !Number.isInteger(entry.line) || entry.line < 1) continue;
    const verifies = (index) => index >= 0 && index < textLines.length &&
      (!entry.testCaseId || caseIds[index] === entry.testCaseId) && lineMatches(parsedLines[index], entry);
    let index = entry.line - 1;
    if (!verifies(index)) {
      const matches = textLines.map((_, i) => i).filter(verifies);
      matches.sort((a, b) => Math.abs(a - index) - Math.abs(b - index) || a - b);
      if (!matches.length) continue;
      index = matches[0];
    }
    if (!highlighted.has(index)) {
      highlighted.add(index); result.push({ line: index + 1, entry });
    }
  }
  return result.sort((a, b) => a.line - b.line);
}

function findCsHighlights(textLines) {
  const state = {};
  return textLines.flatMap((text, index) => {
    // Ignore marker-shaped text inside C# strings. Accept both legacy spacing
    // and the specified case form: [TLL L21], [TLLL21], [TLL TC01:L21].
    const comment = tokens(text, true, state).find((token) => token.kind === "comment")?.value || "";
    const match = /\/\/\s*\[TLL(?:\s+([A-Za-z0-9_-]+):|\s*)L(\d+)\]/.exec(comment);
    return match && Number(match[2]) > 0
      ? [{ line: index + 1, caseId: match[1] || null, sourceLine: Number(match[2]) }] : [];
  });
}

function buildTooltip(entry = {}) {
  const escape = (value) => String(value ?? "Not recorded")
    .replace(/[\\`*_{}\[\]()#+.!|>-]/g, "\\$&").replace(/</g, "&lt;").replace(/[\r\n]+/g, " ");
  const provenance = JSON.stringify([entry.strategy, entry.provenance, entry.reason, entry.validation, entry.liveValidated]);
  const negative = entry.liveValidated === false || entry.provenance?.liveValidated === false ||
    entry.validation?.liveValidated === false ||
    /forced|fallback|inferred|heuristic|not.?live|not.?validated|unverified|incomplete|skipped|failed/i.test(provenance);
  const positive = entry.liveValidated === true || entry.provenance?.liveValidated === true;
  const confidence = typeof entry.confidence === "number" ? entry.confidence : null;
  const validated = positive && !negative && entry.uniqueMatch === true && confidence !== null && confidence >= 0.65;
  return [
    "**Table locator rewrite**",
    `- Case: ${escape(entry.testCaseId || "Legacy / unspecified")}`,
    `- Source line: ${escape(entry.sourceLine ?? entry.line)}`,
    `- Original locator: ${escape(entry.originalLocator || "Unavailable: not stored by this metadata schema")}`,
    `- Generated locator: ${escape(entry.locator || entry.generatedLocator)}`,
    `- Strategy: ${escape(entry.strategy)}`,
    `- Confidence: ${escape(entry.confidence)}`,
    `- uniqueMatch: ${escape(entry.uniqueMatch)}`,
    "",
    validated ? "Live-validation evidence is recorded; review warnings still apply."
      : "**NOT LIVE-VALIDATED / not established by this metadata.** Forced, fallback, inferred or low-confidence selection is not proof of live uniqueness.",
    "",
    "Yellow records rewrite provenance only. It does not override failed validation or incomplete replay."
  ].join("\n");
}

module.exports = { isTransformed, findTsHighlights, findCsHighlights, buildTooltip };