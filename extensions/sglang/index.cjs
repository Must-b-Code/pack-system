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

// src/core/extensions/sglang/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_core = require("src/core/source/plugin-sdk/core");
var PROVIDER_ID = "sglang";
var DEFAULT_BASE_URL = "http://127.0.0.1:30000/v1";
var sglangPlugin = {
  id: "sglang",
  name: "SGLang Provider",
  description: "Bundled SGLang provider plugin",
  configSchema: (0, import_core.emptyPluginConfigSchema)(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "SGLang",
      docsPath: "/providers/sglang",
      envVars: ["SGLANG_API_KEY"],
      auth: [
        {
          id: "custom",
          label: "SGLang",
          hint: "Fast self-hosted OpenAI-compatible server",
          kind: "custom",
          run: async (ctx) => {
            const result = await (0, import_core.promptAndConfigureOpenAICompatibleSelfHostedProvider)({
              cfg: ctx.config,
              prompter: ctx.prompter,
              providerId: PROVIDER_ID,
              providerLabel: "SGLang",
              defaultBaseUrl: DEFAULT_BASE_URL,
              defaultApiKeyEnvVar: "SGLANG_API_KEY",
              modelPlaceholder: "Qwen/Qwen3-8B"
            });
            return {
              profiles: [
                {
                  profileId: result.profileId,
                  credential: result.credential
                }
              ],
              configPatch: result.config,
              defaultModel: result.modelRef
            };
          },
          runNonInteractive: async (ctx) => (0, import_core.configureOpenAICompatibleSelfHostedProviderNonInteractive)({
            ctx,
            providerId: PROVIDER_ID,
            providerLabel: "SGLang",
            defaultBaseUrl: DEFAULT_BASE_URL,
            defaultApiKeyEnvVar: "SGLANG_API_KEY",
            modelPlaceholder: "Qwen/Qwen3-8B"
          })
        }
      ],
      discovery: {
        order: "late",
        run: async (ctx) => {
          if (ctx.config.models?.providers?.sglang) {
            return null;
          }
          const { apiKey, discoveryApiKey } = ctx.resolveProviderApiKey(PROVIDER_ID);
          if (!apiKey) {
            return null;
          }
          return {
            provider: {
              ...await (0, import_core.buildSglangProvider)({ apiKey: discoveryApiKey }),
              apiKey
            }
          };
        }
      },
      wizard: {
        onboarding: {
          choiceId: "sglang",
          choiceLabel: "SGLang",
          choiceHint: "Fast self-hosted OpenAI-compatible server",
          groupId: "sglang",
          groupLabel: "SGLang",
          groupHint: "Fast self-hosted server",
          methodId: "custom"
        },
        modelPicker: {
          label: "SGLang (custom)",
          hint: "Enter SGLang URL + API key + model",
          methodId: "custom"
        }
      }
    });
  }
};
var index_default = sglangPlugin;
