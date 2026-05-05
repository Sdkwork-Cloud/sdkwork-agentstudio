import assert from 'node:assert/strict';

export function derivePreviousNumericVersion(version) {
  const [major, minor, patch] = parseNumericVersionParts(version);

  if (patch > 0) {
    return `${major}.${minor}.${patch - 1}`;
  }
  if (minor > 0) {
    return `${major}.${minor - 1}.0`;
  }
  assert.ok(major > 0, `Expected a previous numeric version to exist for ${version}`);
  return `${major - 1}.0.0`;
}

export function shiftNumericVersion(version, patchOffset) {
  const [major, minor, patch] = parseNumericVersionParts(version);
  const shiftedPatch = patch + patchOffset;
  assert.ok(shiftedPatch >= 0, `Cannot derive numeric test version before patch 0 from ${version}`);
  return `${major}.${minor}.${shiftedPatch}`;
}

function parseNumericVersionParts(version) {
  const match = String(version).match(
    /^(\d+)\.(\d+)\.(\d+)(?:-(?:\d+|[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*))?$/u,
  );
  assert.ok(
    match,
    `Expected numeric x.y.z, x.y.z-N, or x.y.z-beta.N version, received ${version}`,
  );

  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ];
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
