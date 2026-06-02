export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function nextFileId(): string {
  return `f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
