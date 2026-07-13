const MANIFEST_ID = "dl-preview-manifest";
const MANIFEST_TYPE = "application/json";
const RAW_TEXT = new Set(["iframe", "noembed", "noframes", "noscript", "script", "style", "textarea", "title", "xmp"]);
// Indexed by code point - 0x80, matching HTML numeric character-reference replacements.
const C1_REPLACEMENTS = [8364, 129, 8218, 402, 8222, 8230, 8224, 8225, 710, 8240, 352, 8249, 338, 141, 381, 143, 144, 8216, 8217, 8220, 8221, 8226, 8211, 8212, 732, 8482, 353, 8250, 339, 157, 382, 376];
const FOREIGN_BREAKOUT = new Set([
  "b", "big", "blockquote", "body", "br", "center", "code", "dd", "div", "dl", "dt", "em", "embed", "h1", "h2", "h3", "h4", "h5", "h6", "head", "hr", "i", "img", "li", "listing", "menu", "meta", "nobr", "ol", "p", "pre", "ruby", "s", "small", "span", "strong", "strike", "sub", "sup", "table", "tt", "u", "ul", "var",
]);

function asciiLower(value) {
  let result = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    result += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : character;
  }
  return result;
}

function isSpace(character) {
  return character === " " || character === "\t" || character === "\n" || character === "\f" || character === "\r";
}

function isAsciiLetter(character) {
  const code = character?.charCodeAt(0) ?? 0;
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function startsWithAscii(source, offset, expected) {
  return asciiLower(source.slice(offset, offset + expected.length)) === expected;
}

function sequenceEnd(source, offset, sequence) {
  const index = source.indexOf(sequence, offset);
  return index === -1 || source.slice(offset, index).includes("\0") ? -1 : index + sequence.length;
}

function decodeAttributeValue(value) {
  return value.replace(/&(?:#([0-9]+);?|#[xX]([0-9a-fA-F]+);?|sol;|plus;|hyphen;)/g, (reference, decimal, hexadecimal) => {
    if (reference === "&sol;") return "/";
    if (reference === "&plus;") return "+";
    if (reference === "&hyphen;") return "\u2010";
    const codePoint = Number.parseInt(decimal ?? hexadecimal, decimal === undefined ? 16 : 10);
    if (codePoint === 0 || codePoint > 0x10ffff || codePoint >= 0xd800 && codePoint <= 0xdfff) return "\ufffd";
    return String.fromCodePoint(codePoint >= 0x80 && codePoint <= 0x9f ? C1_REPLACEMENTS[codePoint - 0x80] : codePoint);
  });
}

function commentEnd(source, offset) {
  for (let index = offset; index < source.length; index += 1) {
    if (source.slice(index, index + 4) === "<!--") return -1;
    if (source.slice(index, index + 3) === "-->") return index + 3;
    if (source[index] === "\0") return -1;
  }
  return -1;
}

function readTag(source, offset) {
  let index = offset + 1;
  const closing = source[index] === "/";
  if (closing) index += 1;
  if (!isAsciiLetter(source[index])) return null;
  const nameStart = index;
  while (index < source.length && !isSpace(source[index]) && source[index] !== "/" && source[index] !== ">") {
    if (source[index] === "\0" || source[index] === "<" || source[index] === "=" || source[index] === '"' || source[index] === "'") return null;
    index += 1;
  }
  const name = asciiLower(source.slice(nameStart, index));
  const attributes = new Map();
  while (index < source.length) {
    while (isSpace(source[index])) index += 1;
    if (source[index] === ">") return { attributes, closing, end: index + 1, name, selfClosing: false };
    if (source[index] === "/") {
      index += 1;
      while (isSpace(source[index])) index += 1;
      return source[index] === ">" ? { attributes, closing, end: index + 1, name, selfClosing: true } : null;
    }
    if (closing || index >= source.length) return null;
    const attributeStart = index;
    while (index < source.length && !isSpace(source[index]) && source[index] !== "/" && source[index] !== ">" && source[index] !== "=") {
      if (source[index] === "\0" || source[index] === "<" || source[index] === '"' || source[index] === "'") return null;
      index += 1;
    }
    if (index === attributeStart) return null;
    const attributeName = asciiLower(source.slice(attributeStart, index));
    if (attributes.has(attributeName)) return null;
    while (isSpace(source[index])) index += 1;
    let value = null;
    if (source[index] === "=") {
      index += 1;
      while (isSpace(source[index])) index += 1;
      const quote = source[index] === '"' || source[index] === "'" ? source[index] : null;
      if (quote !== null) {
        index += 1;
        const valueStart = index;
        while (index < source.length && source[index] !== quote) {
          if (source[index] === "\0") return null;
          index += 1;
        }
        if (index >= source.length) return null;
        value = source.slice(valueStart, index);
        index += 1;
        if (index < source.length && !isSpace(source[index]) && source[index] !== "/" && source[index] !== ">") return null;
      } else {
        const valueStart = index;
        while (index < source.length && !isSpace(source[index]) && source[index] !== ">") {
          if (source[index] === "\0" || source[index] === '"' || source[index] === "'" || source[index] === "<" || source[index] === "=" || source[index] === "`") return null;
          index += 1;
        }
        if (index === valueStart) return null;
        value = source.slice(valueStart, index);
      }
    }
    attributes.set(attributeName, value === null ? null : decodeAttributeValue(value));
  }
  return null;
}

function readRawText(source, offset, name) {
  let scriptEscaped = false;
  let scriptDoubleEscaped = false;
  for (let index = offset; index < source.length; index += 1) {
    if (source[index] === "\0") return null;
    if (name === "script" && !scriptEscaped && source.slice(index, index + 4) === "<!--") {
      scriptEscaped = true;
      index += 3;
      continue;
    }
    if (name === "script" && scriptEscaped && !scriptDoubleEscaped && source[index] === "<" && startsWithAscii(source, index + 1, "script")) {
      const boundary = source[index + 7];
      if (isSpace(boundary) || boundary === "/" || boundary === ">") scriptDoubleEscaped = true;
      continue;
    }
    if (name === "script" && scriptDoubleEscaped && source[index] === "<" && source[index + 1] === "/" && startsWithAscii(source, index + 2, "script")) {
      const boundary = source[index + 8];
      if (isSpace(boundary) || boundary === "/" || boundary === ">") scriptDoubleEscaped = false;
      continue;
    }
    if (name === "script" && scriptEscaped && !scriptDoubleEscaped && source.slice(index, index + 3) === "-->") {
      scriptEscaped = false;
      index += 2;
      continue;
    }
    if (source[index] !== "<" || source[index + 1] !== "/" || !startsWithAscii(source, index + 2, name)) continue;
    const boundary = index + 2 + name.length;
    if (boundary === source.length) return null;
    if (!isSpace(source[boundary]) && source[boundary] !== "/" && source[boundary] !== ">") continue;
    const tag = readTag(source, index);
    if (tag === null || !tag.closing || tag.name !== name || tag.selfClosing || tag.attributes.size !== 0) return null;
    return { end: tag.end, text: source.slice(offset, index) };
  }
  return null;
}

function readDeclaration(source, offset) {
  if (!startsWithAscii(source, offset + 2, "doctype") || !isSpace(source[offset + 9])) return -1;
  let quote = null;
  for (let index = offset + 10; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === ">") return index + 1;
    else if (character === "\0" || character === "<") return -1;
  }
  return -1;
}

function integrationMode(namespace, name, attributes) {
  if (namespace === "svg" && (name === "foreignobject" || name === "desc" || name === "title")) return "html";
  if (namespace === "math" && (name === "mi" || name === "mo" || name === "mn" || name === "ms" || name === "mtext")) return "math-text";
  if (namespace !== "math" || name !== "annotation-xml") return null;
  const encoding = attributes.get("encoding");
  if (encoding === null || encoding === undefined) return null;
  const normalized = asciiLower(encoding);
  return normalized === "text/html" || normalized === "application/xhtml+xml" ? "html" : null;
}

function popForeign(foreign, name) {
  if (foreign.at(-1)?.name !== name) return false;
  foreign.pop();
  return true;
}

export function discoverPreviewManifestSource(source) {
  const candidates = [];
  const foreign = [];
  let templateDepth = 0;
  let index = 0;
  while (index < source.length) {
    if (source[index] === "\0") return null;
    if (source[index] !== "<") {
      index += 1;
      continue;
    }
    const foreignMode = foreign.at(-1)?.integration ?? null;
    const parsesForeign = foreign.length > 0 && foreignMode === null;
    if (source.slice(index, index + 4) === "<!--") {
      index = commentEnd(source, index + 4);
      if (index < 0) return null;
      continue;
    }
    if (source[index + 1] === "!") {
      if (parsesForeign && source.slice(index + 2, index + 9) === "[CDATA[") index = sequenceEnd(source, index + 9, "]]>");
      else index = readDeclaration(source, index);
      if (index < 0) return null;
      continue;
    }
    if (source[index + 1] === "?") { index = sequenceEnd(source, index + 2, ">"); if (index < 0) return null; continue; }
    if (source[index + 1] !== "/" && !isAsciiLetter(source[index + 1])) {
      index += 1;
      continue;
    }
    const tag = readTag(source, index);
    if (tag === null || tag.closing && tag.selfClosing) return null;
    index = tag.end;
    if (tag.closing) {
      if (foreign.length > 0 && popForeign(foreign, tag.name)) continue;
      if (parsesForeign || tag.name === "template" && templateDepth === 0) return null;
      if (tag.name === "template") templateDepth -= 1;
      continue;
    }
    const mathException = foreignMode === "math-text" && (tag.name === "mglyph" || tag.name === "malignmark");
    if (parsesForeign || mathException) {
      const breakout = FOREIGN_BREAKOUT.has(tag.name) || tag.name === "font" && ["color", "face", "size"].some((name) => tag.attributes.has(name));
      if (breakout) {
        while (foreign.at(-1)?.integration === null) foreign.pop();
      }
      else {
        if (!tag.selfClosing) {
          const namespace = foreign.at(-1).namespace;
          foreign.push({ integration: integrationMode(namespace, tag.name, tag.attributes), name: tag.name, namespace });
        }
        continue;
      }
    }
    if (tag.name === "svg" || tag.name === "math") {
      if (!tag.selfClosing) foreign.push({ integration: null, name: tag.name, namespace: tag.name });
      continue;
    }
    if (tag.name === "template") {
      if (tag.selfClosing) return null;
      templateDepth += 1;
      continue;
    }
    if (tag.name === "plaintext") {
      if (tag.selfClosing) return null;
      index = source.length;
      continue;
    }
    if (!RAW_TEXT.has(tag.name)) continue;
    if (tag.selfClosing) return null;
    const raw = readRawText(source, index, tag.name);
    if (raw === null) return null;
    if (tag.name === "script" && templateDepth === 0 && tag.attributes.get("id") === MANIFEST_ID) {
      candidates.push({ source: raw.text, validType: tag.attributes.get("type") === MANIFEST_TYPE });
    }
    index = raw.end;
  }
  if (templateDepth !== 0 || foreign.length !== 0 || candidates.length !== 1 || !candidates[0].validType) return null;
  return candidates[0].source;
}
