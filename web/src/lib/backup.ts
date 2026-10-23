/**
 * Murmur's backup file: what this browser holds for the app (saved mixes,
 * your own sounds with their audio, and preferences) as one download.
 *
 * A small container rather than a zip, so there is no dependency and the
 * audio is stored as it is: the bytes "MURMURBK", a version byte, the header's
 * length as a little-endian u32, the JSON header, then every file's bytes in
 * the header's order. Building it is one Blob of parts, so nothing is copied;
 * reading it is slices of the File, so nothing is loaded until it is stored.
 */

const MAGIC = "MURMURBK"
const VERSION = 1
const PREFIX = MAGIC.length + 1 + 4

export interface BackupContents {
  saved: unknown
  customs: unknown
  prefs: unknown
}

interface BackupFileEntry {
  id: string
  type: string
  name: string
  size: number
}

/** A backup that can't be read, with the sentence to show for it. */
export class BackupError extends Error {}

export function buildBackup(
  contents: BackupContents,
  blobs: Map<string, Blob>
): Blob {
  const files: BackupFileEntry[] = [...blobs].map(([id, blob]) => ({
    id,
    type: blob.type,
    name: blob instanceof File ? blob.name : id,
    size: blob.size,
  }))
  const header = new TextEncoder().encode(
    JSON.stringify({
      version: VERSION,
      exportedAt: new Date().toISOString(),
      ...contents,
      files,
    })
  )
  const prefix = new Uint8Array(PREFIX)
  prefix.set(new TextEncoder().encode(MAGIC))
  prefix[MAGIC.length] = VERSION
  new DataView(prefix.buffer).setUint32(MAGIC.length + 1, header.length, true)
  return new Blob([prefix, header, ...blobs.values()], {
    type: "application/octet-stream",
  })
}

export async function readBackup(
  file: Blob
): Promise<{ contents: BackupContents; blobs: Map<string, Blob> }> {
  const damaged = new BackupError("That backup is damaged")
  const prefix = new Uint8Array(await file.slice(0, PREFIX).arrayBuffer())
  const magic = new TextDecoder().decode(prefix.subarray(0, MAGIC.length))
  if (prefix.length < PREFIX || magic !== MAGIC) {
    throw new BackupError("That file isn’t a Murmur backup")
  }
  if (prefix[MAGIC.length] > VERSION) {
    throw new BackupError("This backup is from a newer Murmur")
  }
  const headerLength = new DataView(prefix.buffer).getUint32(
    MAGIC.length + 1,
    true
  )
  let offset = PREFIX
  if (offset + headerLength > file.size) throw damaged
  let header: Record<string, unknown>
  try {
    header = JSON.parse(await file.slice(offset, offset + headerLength).text())
  } catch {
    throw damaged
  }
  offset += headerLength

  const blobs = new Map<string, Blob>()
  for (const entry of Array.isArray(header.files) ? header.files : []) {
    const { id, type, name, size } = (entry ?? {}) as Partial<BackupFileEntry>
    if (
      typeof id !== "string" ||
      typeof size !== "number" ||
      !Number.isInteger(size) ||
      size < 0 ||
      offset + size > file.size
    ) {
      throw damaged
    }
    blobs.set(
      id,
      new File([file.slice(offset, offset + size)], name ?? id, {
        type: typeof type === "string" ? type : "",
      })
    )
    offset += size
  }
  return {
    contents: {
      saved: header.saved,
      customs: header.customs,
      prefs: header.prefs,
    },
    blobs,
  }
}
