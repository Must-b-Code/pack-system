"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/core/extensions/llm-task/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => register
});
module.exports = __toCommonJS(index_exports);

// src/core/extensions/llm-task/src/llm-task-tool.ts
var import_promises = __toESM(require("node:fs/promises"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_typebox = require("@sinclair/typebox");
var import_ajv = __toESM(require("ajv"), 1);
var import_llm_task = require("src/core/source/plugin-sdk/llm-task");
async function loadRunEmbeddedPiAgent() {
  try {
    const mod2 = await import("../../../src/agents/pi-embedded-runner.js");
    if (typeof mod2.runEmbeddedPiAgent === "function") {
      return mod2.runEmbeddedPiAgent;
    }
  } catch {
  }
  const distExtensionApi = "../../../dist/extensionAPI.js";
  const mod = await import(distExtensionApi);
  const fn = mod.runEmbeddedPiAgent;
  if (typeof fn !== "function") {
    throw new Error("Internal error: runEmbeddedPiAgent not available");
  }
  return fn;
}
function stripCodeFences(s) {
  const trimmed = s.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (m) {
    return (m[1] ?? "").trim();
  }
  return trimmed;
}
function collectText(payloads) {
  const texts = (payloads ?? []).filter((p) => !p.isError && typeof p.text === "string").map((p) => p.text ?? "");
  return texts.join("\n").trim();
}
function toModelKey(provider, model) {
  const p = provider?.trim();
  const m = model?.trim();
  if (!p || !m) {
    return void 0;
  }
  return `${p}/${m}`;
}
function createLlmTaskTool(api) {
  return {
    name: "llm-task",
    label: "LLM Task",
    description: "Run a generic JSON-only LLM task and return schema-validated JSON. Designed for orchestration from Lobster workflows via must-b.invoke.",
    parameters: import_typebox.Type.Object({
      prompt: import_typebox.Type.String({ description: "Task instruction for the LLM." }),
      input: import_typebox.Type.Optional(import_typebox.Type.Unknown({ description: "Optional input payload for the task." })),
      schema: import_typebox.Type.Optional(
        import_typebox.Type.Unknown({ description: "Optional JSON Schema to validate the returned JSON." })
      ),
      provider: import_typebox.Type.Optional(
        import_typebox.Type.String({ description: "Provider override (e.g. openai-codex, anthropic)." })
      ),
      model: import_typebox.Type.Optional(import_typebox.Type.String({ description: "Model id override." })),
      thinking: import_typebox.Type.Optional(import_typebox.Type.String({ description: "Thinking level override." })),
      authProfileId: import_typebox.Type.Optional(import_typebox.Type.String({ description: "Auth profile override." })),
      temperature: import_typebox.Type.Optional(import_typebox.Type.Number({ description: "Best-effort temperature override." })),
      maxTokens: import_typebox.Type.Optional(import_typebox.Type.Number({ description: "Best-effort maxTokens override." })),
      timeoutMs: import_typebox.Type.Optional(import_typebox.Type.Number({ description: "Timeout for the LLM run." }))
    }),
    async execute(_id, params) {
      const prompt = typeof params.prompt === "string" ? params.prompt : "";
      if (!prompt.trim()) {
        throw new Error("prompt required");
      }
      const pluginCfg = api.pluginConfig ?? {};
      const defaultsModel = api.config?.agents?.defaults?.model;
      const primary = typeof defaultsModel === "string" ? defaultsModel.trim() : defaultsModel?.primary?.trim() ?? void 0;
      const primaryProvider = typeof primary === "string" ? primary.split("/")[0] : void 0;
      const primaryModel = typeof primary === "string" ? primary.split("/").slice(1).join("/") : void 0;
      const provider = typeof params.provider === "string" && params.provider.trim() || typeof pluginCfg.defaultProvider === "string" && pluginCfg.defaultProvider.trim() || primaryProvider || void 0;
      const model = typeof params.model === "string" && params.model.trim() || typeof pluginCfg.defaultModel === "string" && pluginCfg.defaultModel.trim() || primaryModel || void 0;
      const authProfileId = (
        // oxlint-disable-next-line typescript/no-explicit-any
        typeof params.authProfileId === "string" && // oxlint-disable-next-line typescript/no-explicit-any
        params.authProfileId.trim() || typeof pluginCfg.defaultAuthProfileId === "string" && pluginCfg.defaultAuthProfileId.trim() || void 0
      );
      const modelKey = toModelKey(provider, model);
      if (!provider || !model || !modelKey) {
        throw new Error(
          `provider/model could not be resolved (provider=${String(provider ?? "")}, model=${String(model ?? "")})`
        );
      }
      const allowed = Array.isArray(pluginCfg.allowedModels) ? pluginCfg.allowedModels : void 0;
      if (allowed && allowed.length > 0 && !allowed.includes(modelKey)) {
        throw new Error(
          `Model not allowed by llm-task plugin config: ${modelKey}. Allowed models: ${allowed.join(", ")}`
        );
      }
      const thinkingRaw = typeof params.thinking === "string" && params.thinking.trim() ? params.thinking : void 0;
      const thinkLevel = thinkingRaw ? (0, import_llm_task.normalizeThinkLevel)(thinkingRaw) : void 0;
      if (thinkingRaw && !thinkLevel) {
        throw new Error(
          `Invalid thinking level "${thinkingRaw}". Use one of: ${(0, import_llm_task.formatThinkingLevels)(provider, model)}.`
        );
      }
      if (thinkLevel === "xhigh" && !(0, import_llm_task.supportsXHighThinking)(provider, model)) {
        throw new Error(`Thinking level "xhigh" is only supported for ${(0, import_llm_task.formatXHighModelHint)()}.`);
      }
      const timeoutMs = (typeof params.timeoutMs === "number" && params.timeoutMs > 0 ? params.timeoutMs : void 0) || (typeof pluginCfg.timeoutMs === "number" && pluginCfg.timeoutMs > 0 ? pluginCfg.timeoutMs : void 0) || 3e4;
      const streamParams = {
        temperature: typeof params.temperature === "number" ? params.temperature : void 0,
        maxTokens: typeof params.maxTokens === "number" ? params.maxTokens : typeof pluginCfg.maxTokens === "number" ? pluginCfg.maxTokens : void 0
      };
      const input = params.input;
      let inputJson;
      try {
        inputJson = JSON.stringify(input ?? null, null, 2);
      } catch {
        throw new Error("input must be JSON-serializable");
      }
      const system = [
        "You are a JSON-only function.",
        "Return ONLY a valid JSON value.",
        "Do not wrap in markdown fences.",
        "Do not include commentary.",
        "Do not call tools."
      ].join(" ");
      const fullPrompt = `${system}

TASK:
${prompt}

INPUT_JSON:
${inputJson}
`;
      let tmpDir = null;
      try {
        tmpDir = await import_promises.default.mkdtemp(
          import_node_path.default.join((0, import_llm_task.resolvePreferredMustBTmpDir)(), "must-b-llm-task-")
        );
        const sessionId = `llm-task-${Date.now()}`;
        const sessionFile = import_node_path.default.join(tmpDir, "session.json");
        const runEmbeddedPiAgent = await loadRunEmbeddedPiAgent();
        const result = await runEmbeddedPiAgent({
          sessionId,
          sessionFile,
          workspaceDir: api.config?.agents?.defaults?.workspace ?? process.cwd(),
          config: api.config,
          prompt: fullPrompt,
          timeoutMs,
          runId: `llm-task-${Date.now()}`,
          provider,
          model,
          authProfileId,
          authProfileIdSource: authProfileId ? "user" : "auto",
          thinkLevel,
          streamParams,
          disableTools: true
        });
        const text = collectText(result.payloads);
        if (!text) {
          throw new Error("LLM returned empty output");
        }
        const raw = stripCodeFences(text);
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new Error("LLM returned invalid JSON");
        }
        const schema = params.schema;
        if (schema && typeof schema === "object" && !Array.isArray(schema)) {
          const ajv = new import_ajv.default.default({ allErrors: true, strict: false });
          const validate = ajv.compile(schema);
          const ok = validate(parsed);
          if (!ok) {
            const msg = validate.errors?.map(
              (e) => `${e.instancePath || "<root>"} ${e.message || "invalid"}`
            ).join("; ") ?? "invalid";
            throw new Error(`LLM JSON did not match schema: ${msg}`);
          }
        }
        return {
          content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
          details: { json: parsed, provider, model }
        };
      } finally {
        if (tmpDir) {
          try {
            await import_promises.default.rm(tmpDir, { recursive: true, force: true });
          } catch {
          }
        }
      }
    }
  };
}

// src/core/extensions/llm-task/index.ts
function register(api) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
