import { deriveKey, bytesToB64, b64ToBytes } from '../utils/crypto'

export const encryptToken = async (
  token: string,
  passphrase: string,
): Promise<{ encryptedToken: string; tokenSalt: string; tokenIv: string }> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  return {
    encryptedToken: bytesToB64(new Uint8Array(ciphertext)),
    tokenSalt: bytesToB64(salt),
    tokenIv: bytesToB64(iv),
  }
}

export const decryptToken = async (
  encryptedToken: string,
  passphrase: string,
  tokenSalt: string,
  tokenIv: string,
): Promise<string> => {
  const key = await deriveKey(passphrase, b64ToBytes(tokenSalt))
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(tokenIv) },
    key,
    b64ToBytes(encryptedToken),
  )
  return new TextDecoder().decode(plaintext)
}
