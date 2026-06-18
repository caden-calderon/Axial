const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 8;
const TOKEN_BYTES = 32;

export function generateRoomCode(): string {
  return randomFromAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);
}

export function normalizeRoomCode(value: string): string | null {
  const normalized = value.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized)) return null;
  return normalized;
}

export function formatRoomCode(roomCode: string): string {
  const normalized = normalizeRoomCode(roomCode) ?? roomCode;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function generateReconnectToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function randomFromAlphabet(alphabet: string, length: number): string {
  const chars: string[] = [];
  const maxUnbiasedByte = 256 - (256 % alphabet.length);

  while (chars.length < length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= maxUnbiasedByte) continue;
      chars.push(alphabet[byte % alphabet.length]);
      if (chars.length === length) break;
    }
  }

  return chars.join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
