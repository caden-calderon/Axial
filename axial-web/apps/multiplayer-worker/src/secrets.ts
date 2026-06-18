const TEXT_ENCODER = new TextEncoder();

export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    TEXT_ENCODER.encode(secret),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function verifySecret(
  secret: string,
  expectedHash: string,
): Promise<boolean> {
  const providedHash = await hashSecret(secret);
  const providedBytes = hexToBytes(providedHash);
  const expectedBytes = hexToBytes(expectedHash);

  if (providedBytes.length !== expectedBytes.length) return false;

  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (
      a: ArrayBuffer | ArrayBufferView,
      b: ArrayBuffer | ArrayBufferView,
    ) => boolean;
  };

  if (subtle.timingSafeEqual) {
    return subtle.timingSafeEqual(providedBytes, expectedBytes);
  }

  let diff = 0;
  for (let index = 0; index < providedBytes.length; index += 1) {
    diff |= providedBytes[index] ^ expectedBytes[index];
  }
  return diff === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return new Uint8Array();

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
