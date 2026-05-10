import { vi } from 'vitest'

/**
 * Mocks the FileReader API so that readAsText synchronously calls onload
 * with the given content string.
 */
export function mockFileReader(content: string) {
  const mockReader = {
    readAsText: vi.fn(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: content, writable: true })
      if (this.onload) this.onload({ target: this } as ProgressEvent<FileReader>)
    }),
    readAsDataURL: vi.fn(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: content, writable: true })
      if (this.onload) this.onload({ target: this } as ProgressEvent<FileReader>)
    }),
    onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
    onerror: null as ((ev: ProgressEvent<FileReader>) => void) | null,
  }

  vi.spyOn(globalThis, 'FileReader').mockImplementation(() => mockReader as unknown as FileReader)
  return mockReader
}

/**
 * Mocks global fetch with URL-based response mapping.
 * Keys are URL substrings; if the fetch URL includes the key, the mapped response is returned.
 */
export function mockFetch(
  responses: Record<string, { status?: number; body?: unknown; headers?: Record<string, string> }>,
) {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    for (const [pattern, config] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(config.body ?? {}), {
          status: config.status ?? 200,
          headers: { 'Content-Type': 'application/json', ...config.headers },
        })
      }
    }

    return new Response('Not Found', { status: 404 })
  })

  return spy
}

/**
 * Mocks navigator.vibrate and returns the spy for assertions.
 */
export function mockNavigatorVibrate() {
  const spy = vi.fn().mockReturnValue(true)
  Object.defineProperty(navigator, 'vibrate', { value: spy, writable: true, configurable: true })
  return spy
}

/**
 * Creates a synthetic TouchEvent-like object for touch drag testing.
 */
export function makeTouchEvent(clientX: number, clientY: number) {
  return {
    touches: [{ clientX, clientY }],
    changedTouches: [{ clientX, clientY }],
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: document.createElement('div'),
  } as unknown as React.TouchEvent
}
