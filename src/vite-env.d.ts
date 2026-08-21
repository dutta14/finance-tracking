/// <reference types="vite/client" />

/*
 * File System Access API pieces that are not part of TypeScript's DOM lib:
 * permission queries, directory iteration and the picker entry point.
 */
type FileSystemPermissionMode = 'read' | 'readwrite'

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FileSystemDirectoryHandle {
  keys(): AsyncIterableIterator<string>
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>
}

interface DirectoryPickerOptions {
  id?: string
  mode?: FileSystemPermissionMode
  startIn?: string | FileSystemHandle
}

interface Window {
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}

declare function showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
