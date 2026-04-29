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

// src/core/extensions/vllm/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_core = require("src/core/source/plugin-sdk/core");
var PROVIDER_ID = "vllm";
var DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
var vllmPlugin = {
  id: "vllm",
  name: "vLLM Provider",
  description: "Bundled vLLM provider plugin",
  configSchema: (0, import_core.emptyPluginConfigSchema)(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "vLLM",
      docsPath: "/providers/vllm",
      envVars: ["VLLM_API_KEY"],
      auth: [
        {
          id: "custom",
          label: "vLLM",
          hint: "Local/self-hosted OpenAI-compatible server",
          kind: "custom",
          run: async (ctx) => {
            const result = await (0, import_core.promptAndConfigureOpenAICompatibleSelfHostedProvider)({
              cfg: ctx.config,
              prompter: ctx.prompter,
              providerId: PROVIDER_ID,
              providerLabel: "vLLM",
              defaultBaseUrl: DEFAULT_BASE_URL,
              defaultApiKeyEnvVar: "VLLM_API_KEY",
              modelPlaceholder: "meta-llama/Meta-Llama-3-8B-Instruct"
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
            providerLabel: "vLLM",
            defaultBaseUrl: DEFAULT_BASE_URL,
            defaultApiKeyEnvVar: "VLLM_API_KEY",
            modelPlaceholder: "meta-llama/Meta-Llama-3-8B-Instruct"
          })
        }
      ],
      discovery: {
        order: "late",
        run: async (ctx) => {
          if (ctx.config.models?.providers?.vllm) {
            return null;
          }
          const { apiKey, discoveryApiKey } = ctx.resolveProviderApiKey(PROVIDER_ID);
          if (!apiKey) {
            return null;
          }
          return {
            provider: {
              ...await (0, import_core.buildVllmProvider)({ apiKey: discoveryApiKey }),
              apiKey
            }
          };
        }
      },
      wizard: {
        onboarding: {
          choiceId: "vllm",
          choiceLabel: "vLLM",
          choiceHint: "Local/self-hosted OpenAI-compatible server",
          groupId: "vllm",
          groupLabel: "vLLM",
          groupHint: "Local/self-hosted OpenAI-compatible",
          methodId: "custom"
        },
        modelPicker: {
          label: "vLLM (custom)",
          hint: "Enter vLLM URL + API key + model",
          methodId: "custom"
        }
      }
    });
  }
};
var index_default = vllmPlugin;
