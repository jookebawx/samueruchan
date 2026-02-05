import { serialize } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../../shared/const";
import { getSessionCookieOptions } from "../../../server/_core/cookies";
import { initEnv } from "../../../server/_core/env";
import { sdk } from "../../../server/_core/sdk";
import * as db from "../../../server/db";

type Env = {
  DB?: D1Database;
  test_database?: D1Database;
  VITE_APP_ID?: string;
  JWT_SECRET?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OWNER_OPEN_ID?: string;
  BUILT_IN_FORGE_API_URL?: string;
  BUILT_IN_FORGE_API_KEY?: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const toEnvRecord = (env: Env) => {
  const record: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
};

const headersToObject = (headers: Headers) => {
  const record: Record<string, string | string[] | undefined> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
};

export const onRequest = async ({ request, env }: PagesContext) => {
  initEnv(toEnvRecord(env));
  const dbBinding = env.DB ?? env.test_database;
  db.initDb(dbBinding);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response(JSON.stringify({ error: "code and state are required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      return new Response(JSON.stringify({ error: "openId missing from user info" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: Date.now(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const reqLike = {
      headers: headersToObject(request.headers),
      protocol: url.protocol.replace(":", ""),
    };
    const cookieOptions = getSessionCookieOptions(reqLike);
    const cookie = serialize(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: Math.floor(ONE_YEAR_MS / 1000),
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookie,
      },
    });
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    return new Response(JSON.stringify({ error: "OAuth callback failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
