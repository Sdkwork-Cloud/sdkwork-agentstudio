import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const TAR_REGULAR_TYPES = new Set(['', '0']);
const TAR_DIRECTORY_TYPES = new Set(['5']);
const ZIP_UNIX_FILE_TYPE_MASK = 0o170000;
const ZIP_UNIX_REGULAR_FILE_TYPE = 0o100000;
const ZIP_UNIX_DIRECTORY_TYPE = 0o040000;

function parseTarOctal(buffer) {
  const trimmed = buffer.toString('utf8').replace(/\0.*$/, '').trim();
  if (!trimmed) {
    return 0;
  }

  return Number.parseInt(trimmed, 8);
}

function parsePaxHeaders(content) {
  const headers = new Map();
  const source = content.toString('utf8');
  let offset = 0;

  while (offset < source.length) {
    const separatorIndex = source.indexOf(' ', offset);
    if (separatorIndex === -1) {
      break;
    }

    const length = Number.parseInt(source.slice(offset, separatorIndex), 10);
    if (!Number.isFinite(length) || length <= 0) {
      break;
    }

    const record = source.slice(separatorIndex + 1, offset + length - 1);
    const equalsIndex = record.indexOf('=');
    if (equalsIndex !== -1) {
      headers.set(
        record.slice(0, equalsIndex),
        record.slice(equalsIndex + 1),
      );
    }

    offset += length;
  }

  return headers;
}

export function normalizeArchiveEntryPath(entryPath) {
  let normalizedPath = String(entryPath ?? '').replaceAll('\\', '/');
  while (normalizedPath.startsWith('./')) {
    normalizedPath = normalizedPath.slice(2);
  }

  return normalizedPath;
}

export function assertArchiveEntryPathSafe(entryPath, {
  context = 'Release',
} = {}) {
  const normalizedPath = normalizeArchiveEntryPath(entryPath);

  if (!normalizedPath || normalizedPath.includes('\0')) {
    throw new Error(`${context} archive contains unsafe empty path: ${entryPath}`);
  }
  if (normalizedPath.startsWith('/') || /^[A-Za-z]:($|\/)/.test(normalizedPath)) {
    throw new Error(`${context} archive contains unsafe absolute path: ${entryPath}`);
  }

  const hasTrailingSlash = normalizedPath.endsWith('/');
  const segments = normalizedPath.split('/');
  if (hasTrailingSlash) {
    segments.pop();
  }

  if (
    segments.length === 0
    || segments.some((segment) => segment.length === 0 || segment === '.')
  ) {
    throw new Error(`${context} archive contains non-canonical relative path: ${entryPath}`);
  }
  if (segments.some((segment) => segment === '..')) {
    throw new Error(`${context} archive contains unsafe parent traversal path: ${entryPath}`);
  }

  return `${segments.join('/')}${hasTrailingSlash ? '/' : ''}`;
}

function buildDuplicateArchiveEntryKey(normalizedPath) {
  return normalizedPath.replace(/\/+$/, '').toLowerCase();
}

function assertUniqueArchiveEntryPath({
  normalizedPath,
  originalPath,
  seenPaths,
  context,
}) {
  const duplicateKey = buildDuplicateArchiveEntryKey(normalizedPath);
  if (seenPaths.has(duplicateKey)) {
    throw new Error(`${context} archive contains duplicate archive entry: ${originalPath}`);
  }

  seenPaths.add(duplicateKey);
}

function assertTarArchiveEntryTypeAllowed({
  normalizedPath,
  typeFlag,
  context,
}) {
  if (TAR_REGULAR_TYPES.has(typeFlag) || TAR_DIRECTORY_TYPES.has(typeFlag)) {
    return;
  }

  throw new Error(
    `${context} archive contains unsupported archive entry type ${typeFlag || '(empty)'} at ${normalizedPath}`,
  );
}

function assertZipArchiveEntryTypeAllowed({
  normalizedPath,
  unixMode,
  hasUnixMode,
  isDirectory,
  context,
}) {
  if (!hasUnixMode) {
    return;
  }

  const fileType = unixMode & ZIP_UNIX_FILE_TYPE_MASK;
  if (
    fileType === 0
    || fileType === ZIP_UNIX_REGULAR_FILE_TYPE
    || fileType === ZIP_UNIX_DIRECTORY_TYPE
  ) {
    return;
  }

  throw new Error(
    `${context} archive contains unsupported archive entry type ${fileType.toString(8)} at ${normalizedPath}`,
  );
}

export function readTarGzEntries(archivePath, {
  context = 'Release',
} = {}) {
  const archiveBuffer = gunzipSync(readFileSync(archivePath));
  const entries = new Map();
  const seenPaths = new Set();
  let offset = 0;
  let pendingPathOverride = '';

  while (offset + 512 <= archiveBuffer.length) {
    const header = archiveBuffer.subarray(offset, offset + 512);
    const isEmptyHeader = header.every((value) => value === 0);
    if (isEmptyHeader) {
      break;
    }

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = parseTarOctal(header.subarray(124, 136));
    const typeFlag = header.subarray(156, 157).toString('utf8').replace(/\0.*$/, '');
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > archiveBuffer.length) {
      throw new Error(`${context} archive entry exceeds archive bounds: ${fullName}`);
    }

    const content = archiveBuffer.subarray(contentStart, contentEnd);
    const nextOffset = contentStart + Math.ceil(size / 512) * 512;

    if (typeFlag === 'x') {
      pendingPathOverride = parsePaxHeaders(content).get('path') ?? pendingPathOverride;
      offset = nextOffset;
      continue;
    }
    if (typeFlag === 'g') {
      offset = nextOffset;
      continue;
    }
    if (typeFlag === 'L') {
      pendingPathOverride = content.toString('utf8').replace(/\0.*$/, '');
      offset = nextOffset;
      continue;
    }
    if (typeFlag === 'K') {
      offset = nextOffset;
      continue;
    }

    const originalPath = pendingPathOverride || fullName;
    const normalizedPath = assertArchiveEntryPathSafe(originalPath, {
      context,
    });
    assertTarArchiveEntryTypeAllowed({
      normalizedPath,
      typeFlag,
      context,
    });
    assertUniqueArchiveEntryPath({
      normalizedPath,
      originalPath,
      seenPaths,
      context,
    });
    entries.set(normalizedPath, {
      type: typeFlag || '0',
      content,
      size,
    });
    pendingPathOverride = '';

    offset = nextOffset;
  }

  return entries;
}

function findZipEndOfCentralDirectory(buffer) {
  const minimumRecordSize = 22;
  const maxCommentLength = 0xffff;
  const startOffset = Math.max(0, buffer.length - minimumRecordSize - maxCommentLength);

  for (let offset = buffer.length - minimumRecordSize; offset >= startOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

export function readZipArchiveEntries(archivePath, {
  context = 'Release',
} = {}) {
  const archiveBuffer = readFileSync(archivePath);
  const eocdOffset = findZipEndOfCentralDirectory(archiveBuffer);
  if (eocdOffset < 0) {
    throw new Error(`Unable to locate the ZIP central directory in ${archivePath}.`);
  }

  const centralDirectorySize = archiveBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = archiveBuffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > archiveBuffer.length) {
    throw new Error(`ZIP central directory exceeds archive bounds in ${archivePath}.`);
  }

  const entries = [];
  const seenPaths = new Set();
  let offset = centralDirectoryOffset;
  while (offset < centralDirectoryEnd) {
    if (offset + 46 > archiveBuffer.length || archiveBuffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory entry at byte ${offset} in ${archivePath}.`);
    }

    const versionMadeBy = archiveBuffer.readUInt16LE(offset + 4);
    const flags = archiveBuffer.readUInt16LE(offset + 8);
    const compressionMethod = archiveBuffer.readUInt16LE(offset + 10);
    const compressedSize = archiveBuffer.readUInt32LE(offset + 20);
    const uncompressedSize = archiveBuffer.readUInt32LE(offset + 24);
    const fileNameLength = archiveBuffer.readUInt16LE(offset + 28);
    const extraFieldLength = archiveBuffer.readUInt16LE(offset + 30);
    const fileCommentLength = archiveBuffer.readUInt16LE(offset + 32);
    const externalAttributes = archiveBuffer.readUInt32LE(offset + 38);
    const localHeaderOffset = archiveBuffer.readUInt32LE(offset + 42);
    const entryEnd = offset + 46 + fileNameLength + extraFieldLength + fileCommentLength;
    if (entryEnd > centralDirectoryEnd || entryEnd > archiveBuffer.length) {
      throw new Error(`ZIP central directory entry at byte ${offset} exceeds archive bounds in ${archivePath}.`);
    }

    if ((flags & 0x1) !== 0) {
      throw new Error(`${context} archive contains unsupported encrypted ZIP entry at byte ${offset}`);
    }

    const fileName = archiveBuffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    const normalizedPath = assertArchiveEntryPathSafe(fileName, {
      context,
    });
    const versionHost = versionMadeBy >> 8;
    const unixMode = externalAttributes >>> 16;
    const hasUnixMode = versionHost === 3 && unixMode !== 0;
    const zipFileType = unixMode & ZIP_UNIX_FILE_TYPE_MASK;
    const isDirectory =
      normalizedPath.endsWith('/')
      || (hasUnixMode && zipFileType === ZIP_UNIX_DIRECTORY_TYPE)
      || (!hasUnixMode && (externalAttributes & 0x10) !== 0);
    assertZipArchiveEntryTypeAllowed({
      normalizedPath,
      unixMode,
      hasUnixMode,
      isDirectory,
      context,
    });
    assertUniqueArchiveEntryPath({
      normalizedPath,
      originalPath: fileName,
      seenPaths,
      context,
    });

    entries.push({
      fileName,
      normalizedPath,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      externalAttributes,
      unixMode: hasUnixMode ? unixMode : 0,
      type: isDirectory ? 'directory' : 'file',
    });

    offset = entryEnd;
  }

  return entries;
}
