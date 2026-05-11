const trimSlash = (value: string) => value.replace(/\/+$/, '');

export const config = {
  apiBaseUrl: trimSlash(import.meta.env.VITE_API_URL ?? ''),
  socketUrl: trimSlash(import.meta.env.VITE_SOCKET_URL ?? window.location.origin),
  socketPath: import.meta.env.VITE_SOCKET_PATH ?? '/ws',
};

export function toAssetUrl(path: string | null | undefined, fallback = '') {
  if (!path) return fallback;
  if (/^https?:\/\//i.test(path)) return path;
  return `${config.apiBaseUrl}/${path.replace(/^\/+/, '')}`;
}
