import { gzipSync } from 'node:zlib';

function formatTarOctal(value, width) {
  return `${value.toString(8).padStart(width - 2, '0')}\0 `;
}

function createTarHeader({
  name,
  size,
  type = '0',
} = {}) {
  const header = Buffer.alloc(512, 0);
  Buffer.from(String(name ?? '').slice(0, 100), 'utf8').copy(header, 0);
  Buffer.from(formatTarOctal(0o644, 8), 'utf8').copy(header, 100);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 108);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 116);
  Buffer.from(formatTarOctal(size, 12), 'utf8').copy(header, 124);
  Buffer.from(formatTarOctal(0, 12), 'utf8').copy(header, 136);
  header.fill(0x20, 148, 156);
  header.write(String(type ?? '0').slice(0, 1), 156, 1, 'utf8');
  Buffer.from('ustar\0', 'utf8').copy(header, 257);
  Buffer.from('00', 'utf8').copy(header, 263);

  let checksum = 0;
  for (const value of header.values()) {
    checksum += value;
  }
  Buffer.from(formatTarOctal(checksum, 8), 'utf8').copy(header, 148);

  return header;
}

function createTarRecord({
  name,
  content = '',
  type = '0',
} = {}) {
  const contentBuffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(String(content ?? ''), 'utf8');
  const paddingSize = (512 - (contentBuffer.length % 512)) % 512;

  return Buffer.concat([
    createTarHeader({
      name,
      size: contentBuffer.length,
      type,
    }),
    contentBuffer,
    Buffer.alloc(paddingSize, 0),
  ]);
}

export function createTarGzArchive(entries) {
  return gzipSync(Buffer.concat([
    ...entries.map((entry) => createTarRecord(entry)),
    Buffer.alloc(1024, 0),
  ]));
}

export function createStoredZipArchive(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(String(entry.name ?? ''), 'utf8');
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(String(entry.content ?? ''), 'utf8');
    const externalAttributes = Number(entry.externalAttributes ?? 0) >>> 0;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileName, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x031e, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(externalAttributes, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, fileName);

    localOffset += localHeader.length + fileName.length + content.length;
  }

  const centralDirectoryOffset = localOffset;
  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...localParts,
    centralDirectory,
    endOfCentralDirectory,
  ]);
}
