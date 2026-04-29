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

// src/core/extensions/ollama/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_core = require("src/core/source/plugin-sdk/core");
var PROVIDER_ID = "ollama";
var DEFAULT_API_KEY = "ollama-local";
var ollamaPlugin = {
  id: "ollama",
  name: "Ollama Provider",
  description: "Bundled Ollama provider plugin",
  configSchema: (0, import_core.emptyPluginConfigSchema)(),
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "Ollama",
      docsPath: "/providers/ollama",
      envVars: ["OLLAMA_API_KEY"],
      auth: [
        {
          id: "local",
          label: "Ollama",
          hint: "Cloud and local open models",
          kind: "custom",
          run: async (ctx) => {
            const result = await (0, import_core.promptAndConfigureOllama)({
              cfg: ctx.config,
              prompter: ctx.prompter
            });
            return {
              profiles: [
                {
                  profileId: "ollama:default",
                  credential: {
                    type: "api_key",
                    provider: PROVIDER_ID,
                    key: DEFAULT_API_KEY
                  }
                }
              ],
              configPatch: result.config,
              defaultModel: `ollama/${result.defaultModelId}`
            };
          },
          runNonInteractive: async (ctx) => (0, import_core.configureOllamaNonInteractive)({
            nextConfig: ctx.config,
            opts: ctx.opts,
            runtime: ctx.runtime
          })
        }
      ],
      discovery: {
        order: "late",
        run: async (ctx) => {
          const explicit = ctx.config.models?.providers?.ollama;
          const hasExplicitModels = Array.isArray(explicit?.models) && explicit.models.length > 0;
          const ollamaKey = ctx.resolveProviderApiKey(PROVIDER_ID).apiKey;
          if (hasExplicitModels && explicit) {
            return {
              provider: {
                ...explicit,
                baseUrl: typeof explicit.baseUrl === "string" && explicit.baseUrl.trim() ? explicit.baseUrl.trim().replace(/\/+$/, "") : import_core.OLLAMA_DEFAULT_BASE_URL,
                api: explicit.api ?? "ollama",
                apiKey: ollamaKey ?? explicit.apiKey ?? DEFAULT_API_KEY
              }
            };
          }
          const provider = await (0, import_core.buildOllamaProvider)(explicit?.baseUrl, {
            quiet: !ollamaKey && !explicit
          });
          if (provider.models.length === 0 && !ollamaKey && !explicit?.apiKey) {
            return null;
          }
          return {
            provider: {
              ...provider,
              apiKey: ollamaKey ?? explicit?.apiKey ?? DEFAULT_API_KEY
            }
          };
        }
      },
      wizard: {
        onboarding: {
          choiceId: "ollama",
          choiceLabel: "Ollama",
          choiceHint: "Cloud and local open models",
          groupId: "ollama",
          groupLabel: "Ollama",
          groupHint: "Cloud and local open models",
          methodId: "local"
        },
        modelPicker: {
          label: "Ollama (custom)",
          hint: "Detect models from a local or remote Ollama instance",
          methodId: "local"
        }
      },
      onModelSelected: async ({ config, model, prompter }) => {
        if (!model.startsWith("ollama/")) {
          return;
        }
        await (0, import_core.ensureOllamaModelPulled)({ config, prompter });
      }
    });
  }
};
var index_default = ollamaPlugin;
