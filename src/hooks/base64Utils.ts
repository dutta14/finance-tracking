export const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

export const fromBase64 = (b64: string): string => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
