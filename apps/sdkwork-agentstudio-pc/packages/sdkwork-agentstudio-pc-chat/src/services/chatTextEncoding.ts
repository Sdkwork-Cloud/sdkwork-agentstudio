const CP1252_REVERSE_BYTE_BY_CODE_POINT = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const UTF8_MOJIBAKE_MARKER_RE =
  /[\u0080-\u009f\u00c2-\u00c3\u00c4-\u00cf\u00d0-\u00d1\u00e0-\u00ef\u00f0-\u00f4\u00f9-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2018-\u201e\u2020-\u2026\u2030\u2039\u203a\u20ac\u2122\ufffd]/g;
const UNICODE_SIGNAL_RE =
  /[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]|[\u{1f300}-\u{1faff}]/gu;
const UNICODE_ESCAPE_RE = /\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g;

function countMatches(value: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(value)) {
    count += 1;
  }
  return count;
}

function countUtf8MojibakeMarkers(value: string) {
  return countMatches(value, UTF8_MOJIBAKE_MARKER_RE);
}

function countUnicodeSignals(value: string) {
  return countMatches(value, UNICODE_SIGNAL_RE);
}

function encodeMojibakeCodeUnitsToBytes(value: string) {
  const bytes: number[] = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      return null;
    }

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const cp1252Byte = CP1252_REVERSE_BYTE_BY_CODE_POINT.get(codePoint);
    if (cp1252Byte === undefined) {
      return null;
    }

    bytes.push(cp1252Byte);
  }

  return new Uint8Array(bytes);
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function shouldUseRepairedText(original: string, repaired: string) {
  if (!repaired || repaired === original || repaired.includes('\ufffd')) {
    return false;
  }

  const originalMarkerCount = countUtf8MojibakeMarkers(original);
  if (originalMarkerCount === 0) {
    return false;
  }

  const repairedMarkerCount = countUtf8MojibakeMarkers(repaired);
  const originalSignalCount = countUnicodeSignals(original);
  const repairedSignalCount = countUnicodeSignals(repaired);

  if (
    repairedSignalCount > originalSignalCount &&
    repairedMarkerCount < originalMarkerCount
  ) {
    return true;
  }

  return (
    originalMarkerCount >= 2 &&
    repairedMarkerCount <= originalMarkerCount - 2 &&
    repaired.length <= original.length
  );
}

function repairUtf8Mojibake(value: string) {
  if (countUtf8MojibakeMarkers(value) === 0) {
    return value;
  }

  const bytes = encodeMojibakeCodeUnitsToBytes(value);
  if (!bytes) {
    return value;
  }

  const repaired = decodeUtf8(bytes);
  return repaired && shouldUseRepairedText(value, repaired) ? repaired : value;
}

function repairEscapedUnicode(value: string) {
  if (!UNICODE_ESCAPE_RE.test(value)) {
    return value;
  }

  UNICODE_ESCAPE_RE.lastIndex = 0;
  const repaired = value.replace(
    UNICODE_ESCAPE_RE,
    (_match, codePointText: string | undefined, codeUnitText: string | undefined) => {
      const radixText = codePointText ?? codeUnitText;
      if (!radixText) {
        return _match;
      }

      const codePoint = Number.parseInt(radixText, 16);
      if (!Number.isFinite(codePoint)) {
        return _match;
      }

      try {
        return codePointText
          ? String.fromCodePoint(codePoint)
          : String.fromCharCode(codePoint);
      } catch {
        return _match;
      }
    },
  );

  return countUnicodeSignals(repaired) > countUnicodeSignals(value) ? repaired : value;
}

export function normalizeChatMessageTextEncoding(value: string) {
  return repairUtf8Mojibake(repairEscapedUnicode(value));
}
