"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/core/extensions/minimax-portal-auth/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_minimax_portal_auth2 = require("src/core/source/plugin-sdk/minimax-portal-auth");

// src/core/extensions/minimax-portal-auth/oauth.ts
var import_node_crypto = require("node:crypto");
var import_minimax_portal_auth = require("src/core/source/plugin-sdk/minimax-portal-auth");
var MINIMAX_OAUTH_CONFIG = {
  cn: {
    baseUrl: "https://api.minimaxi.com",
    clientId: "78257093-7e40-4613-99e0-527b14b39113"
  },
  global: {
    baseUrl: "https://api.minimax.io",
    clientId: "78257093-7e40-4613-99e0-527b14b39113"
  }
};
var MINIMAX_OAUTH_SCOPE = "group_id profile model.completion";
var MINIMAX_OAUTH_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:user_code";
function getOAuthEndpoints(region) {
  const config = MINIMAX_OAUTH_CONFIG[region];
  return {
    codeEndpoint: `${config.baseUrl}/oauth/code`,
    tokenEndpoint: `${config.baseUrl}/oauth/token`,
    clientId: config.clientId,
    baseUrl: config.baseUrl
  };
}
function generatePkce() {
  const { verifier, challenge } = (0, import_minimax_portal_auth.generatePkceVerifierChallenge)();
  const state = (0, import_node_crypto.randomBytes)(16).toString("base64url");
  return { verifier, challenge, state };
}
async function requestOAuthCode(params) {
  const endpoints = getOAuthEndpoints(params.region);
  const response = await fetch(endpoints.codeEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "x-request-id": (0, import_node_crypto.randomUUID)()
    },
    body: (0, import_minimax_portal_auth.toFormUrlEncoded)({
      response_type: "code",
      client_id: endpoints.clientId,
      scope: MINIMAX_OAUTH_SCOPE,
      code_challenge: params.challenge,
      code_challenge_method: "S256",
      state: params.state
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MiniMax OAuth authorization failed: ${text || response.statusText}`);
  }
  const payload = await response.json();
  if (!payload.user_code || !payload.verification_uri) {
    throw new Error(
      payload.error ?? "MiniMax OAuth authorization returned an incomplete payload (missing user_code or verification_uri)."
    );
  }
  if (payload.state !== params.state) {
    throw new Error("MiniMax OAuth state mismatch: possible CSRF attack or session corruption.");
  }
  return payload;
}
async function pollOAuthToken(params) {
  const endpoints = getOAuthEndpoints(params.region);
  const response = await fetch(endpoints.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: (0, import_minimax_portal_auth.toFormUrlEncoded)({
      grant_type: MINIMAX_OAUTH_GRANT_TYPE,
      client_id: endpoints.clientId,
      user_code: params.userCode,
      code_verifier: params.verifier
    })
  });
  const text = await response.text();
  let payload;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = void 0;
    }
  }
  if (!response.ok) {
    return {
      status: "error",
      message: (payload?.base_resp?.status_msg ?? text) || "MiniMax OAuth failed to parse response."
    };
  }
  if (!payload) {
    return { status: "error", message: "MiniMax OAuth failed to parse response." };
  }
  const tokenPayload = payload;
  if (tokenPayload.status === "error") {
    return { status: "error", message: "An error occurred. Please try again later" };
  }
  if (tokenPayload.status != "success") {
    return { status: "pending", message: "current user code is not authorized" };
  }
  if (!tokenPayload.access_token || !tokenPayload.refresh_token || !tokenPayload.expired_in) {
    return { status: "error", message: "MiniMax OAuth returned incomplete token payload." };
  }
  return {
    status: "success",
    token: {
      access: tokenPayload.access_token,
      refresh: tokenPayload.refresh_token,
      expires: tokenPayload.expired_in,
      resourceUrl: tokenPayload.resource_url,
      notification_message: tokenPayload.notification_message
    }
  };
}
async function loginMiniMaxPortalOAuth(params) {
  const region = params.region ?? "global";
  const { verifier, challenge, state } = generatePkce();
  const oauth = await requestOAuthCode({ challenge, state, region });
  const verificationUrl = oauth.verification_uri;
  const noteLines = [
    `Open ${verificationUrl} to approve access.`,
    `If prompted, enter the code ${oauth.user_code}.`,
    `Interval: ${oauth.interval ?? "default (2000ms)"}, Expires at: ${oauth.expired_in} unix timestamp`
  ];
  await params.note(noteLines.join("\n"), "MiniMax OAuth");
  try {
    await params.openUrl(verificationUrl);
  } catch {
  }
  let pollIntervalMs = oauth.interval ? oauth.interval : 2e3;
  const expireTimeMs = oauth.expired_in;
  while (Date.now() < expireTimeMs) {
    params.progress.update("Waiting for MiniMax OAuth approval\u2026");
    const result = await pollOAuthToken({
      userCode: oauth.user_code,
      verifier,
      region
    });
    if (result.status === "success") {
      return result.token;
    }
    if (result.status === "error") {
      throw new Error(`MiniMax OAuth failed: ${result.message}`);
    }
    if (result.status === "pending") {
      pollIntervalMs = Math.min(pollIntervalMs * 1.5, 1e4);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("MiniMax OAuth timed out waiting for authorization.");
}

// src/core/extensions/minimax-portal-auth/index.ts
var PROVIDER_ID = "minimax-portal";
var PROVIDER_LABEL = "MiniMax";
var DEFAULT_MODEL = "MiniMax-M2.5";
var DEFAULT_BASE_URL_CN = "https://api.minimaxi.com/anthropic";
var DEFAULT_BASE_URL_GLOBAL = "https://api.minimax.io/anthropic";
var DEFAULT_CONTEXT_WINDOW = 2e5;
var DEFAULT_MAX_TOKENS = 8192;
var OAUTH_PLACEHOLDER = "minimax-oauth";
function getDefaultBaseUrl(region) {
  return region === "cn" ? DEFAULT_BASE_URL_CN : DEFAULT_BASE_URL_GLOBAL;
}
function modelRef(modelId) {
  return `${PROVIDER_ID}/${modelId}`;
}
function buildModelDefinition(params) {
  return {
    id: params.id,
    name: params.name,
    reasoning: params.reasoning ?? false,
    input: params.input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS
  };
}
function createOAuthHandler(region) {
  const defaultBaseUrl = getDefaultBaseUrl(region);
  const regionLabel = region === "cn" ? "CN" : "Global";
  return async (ctx) => {
    const progress = ctx.prompter.progress(`Starting MiniMax OAuth (${regionLabel})\u2026`);
    try {
      const result = await loginMiniMaxPortalOAuth({
        openUrl: ctx.openUrl,
        note: ctx.prompter.note,
        progress,
        region
      });
      progress.stop("MiniMax OAuth complete");
      if (result.notification_message) {
        await ctx.prompter.note(result.notification_message, "MiniMax OAuth");
      }
      const baseUrl = result.resourceUrl || defaultBaseUrl;
      return (0, import_minimax_portal_auth2.buildOauthProviderAuthResult)({
        providerId: PROVIDER_ID,
        defaultModel: modelRef(DEFAULT_MODEL),
        access: result.access,
        refresh: result.refresh,
        expires: result.expires,
        configPatch: {
          models: {
            providers: {
              [PROVIDER_ID]: {
                baseUrl,
                apiKey: OAUTH_PLACEHOLDER,
                api: "anthropic-messages",
                models: [
                  buildModelDefinition({
                    id: "MiniMax-M2.5",
                    name: "MiniMax M2.5",
                    input: ["text"]
                  }),
                  buildModelDefinition({
                    id: "MiniMax-M2.5-highspeed",
                    name: "MiniMax M2.5 Highspeed",
                    input: ["text"],
                    reasoning: true
                  }),
                  buildModelDefinition({
                    id: "MiniMax-M2.5-Lightning",
                    name: "MiniMax M2.5 Lightning",
                    input: ["text"],
                    reasoning: true
                  })
                ]
              }
            }
          },
          agents: {
            defaults: {
              models: {
                [modelRef("MiniMax-M2.5")]: { alias: "minimax-m2.5" },
                [modelRef("MiniMax-M2.5-highspeed")]: {
                  alias: "minimax-m2.5-highspeed"
                },
                [modelRef("MiniMax-M2.5-Lightning")]: {
                  alias: "minimax-m2.5-lightning"
                }
              }
            }
          }
        },
        notes: [
          "MiniMax OAuth tokens auto-refresh. Re-run login if refresh fails or access is revoked.",
          `Base URL defaults to ${defaultBaseUrl}. Override models.providers.${PROVIDER_ID}.baseUrl if needed.`,
          ...result.notification_message ? [result.notification_message] : []
        ]
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      progress.stop(`MiniMax OAuth failed: ${errorMsg}`);
      await ctx.prompter.note(
        "If OAuth fails, verify your MiniMax account has portal access and try again.",
        "MiniMax OAuth"
      );
      throw err;
    }
  };
}
var minimaxPortalPlugin = {
  id: "minimax-portal-auth",
  name: "MiniMax OAuth",
  description: "OAuth flow for MiniMax models",
  configSchema: (0, import_minimax_portal_auth2.emptyPluginConfigSchema)(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/minimax",
      aliases: ["minimax"],
      auth: [
        {
          id: "oauth",
          label: "MiniMax OAuth (Global)",
          hint: "Global endpoint - api.minimax.io",
          kind: "device_code",
          run: createOAuthHandler("global")
        },
        {
          id: "oauth-cn",
          label: "MiniMax OAuth (CN)",
          hint: "CN endpoint - api.minimaxi.com",
          kind: "device_code",
          run: createOAuthHandler("cn")
        }
      ]
    });
  }
};
var index_default = minimaxPortalPlugin;
