// Dropbox App key for TodoFlow. It is public by design (PKCE needs no secret).
// Create it at dropbox.com/developers/apps: Scoped access, App folder,
// permissions files.content.read + files.content.write, and add this app's URL
// (for example https://pratheepch.github.io/TestOne/) as a redirect URI.
// A build can also set it with the VITE_DROPBOX_APP_KEY environment variable.
export const DROPBOX_APP_KEY: string = (import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined) ?? '';

/** Where Dropbox sends people back after sign-in: this app's own address. */
export function redirectUri(): string {
  return location.origin + location.pathname;
}
