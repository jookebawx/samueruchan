export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  if (!oauthPortalUrl || !appId) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Auth] Missing VITE_OAUTH_PORTAL_URL or VITE_APP_ID. Check your environment variables."
      );
    }
    return window.location.href;
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(oauthPortalUrl);
  } catch {
    try {
      baseUrl = new URL(`${window.location.protocol}//${oauthPortalUrl}`);
    } catch {
      if (import.meta.env.DEV) {
        console.warn(
          `[Auth] Invalid VITE_OAUTH_PORTAL_URL: ${oauthPortalUrl}`
        );
      }
      return window.location.href;
    }
  }

  const url = new URL("/app-auth", baseUrl);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
