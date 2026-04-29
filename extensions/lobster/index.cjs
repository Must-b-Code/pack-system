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

// src/core/extensions/lobster/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => register
});
module.exports = __toCommonJS(index_exports);

// src/core/extensions/lobster/src/lobster-tool.ts
var import_node_child_process = require("node:child_process");
var import_node_path = __toESM(require("node:path"), 1);
var import_typebox = require("@sinclair/typebox");

// src/core/extensions/lobster/src/windows-spawn.ts
var import_lobster = require("src/core/source/plugin-sdk/lobster");
function resolveWindowsLobsterSpawn(execPath, argv, env) {
  const candidate = (0, import_lobster.resolveWindowsSpawnProgramCandidate)({
    command: execPath,
    env,
    packageName: "lobster"
  });
  const program = (0, import_lobster.applyWindowsSpawnProgramPolicy)({
    candidate,
    allowShellFallback: false
  });
  const resolved = (0, import_lobster.materializeWindowsSpawnProgram)(program, argv);
  if (resolved.shell) {
    throw new Error("lobster wrapper resolved to shell fallback unexpectedly");
  }
  return {
    command: resolved.command,
    argv: resolved.argv,
    windowsHide: resolved.windowsHide
  };
}

// src/core/extensions/lobster/src/lobster-tool.ts
function normalizeForCwdSandbox(p) {
  const normalized = import_node_path.default.normalize(p);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function resolveCwd(cwdRaw) {
  if (typeof cwdRaw !== "string" || !cwdRaw.trim()) {
    return process.cwd();
  }
  const cwd = cwdRaw.trim();
  if (import_node_path.default.isAbsolute(cwd)) {
    throw new Error("cwd must be a relative path");
  }
  const base = process.cwd();
  const resolved = import_node_path.default.resolve(base, cwd);
  const rel = import_node_path.default.relative(normalizeForCwdSandbox(base), normalizeForCwdSandbox(resolved));
  if (rel === "" || rel === ".") {
    return resolved;
  }
  if (rel.startsWith("..") || import_node_path.default.isAbsolute(rel)) {
    throw new Error("cwd must stay within the gateway working directory");
  }
  return resolved;
}
async function runLobsterSubprocessOnce(params) {
  const { execPath, argv, cwd } = params;
  const timeoutMs = Math.max(200, params.timeoutMs);
  const maxStdoutBytes = Math.max(1024, params.maxStdoutBytes);
  const env = { ...process.env, LOBSTER_MODE: "tool" };
  const nodeOptions = env.NODE_OPTIONS ?? "";
  if (nodeOptions.includes("--inspect")) {
    delete env.NODE_OPTIONS;
  }
  const spawnTarget = process.platform === "win32" ? resolveWindowsLobsterSpawn(execPath, argv, env) : { command: execPath, argv };
  return await new Promise((resolve, reject) => {
    const child = (0, import_node_child_process.spawn)(spawnTarget.command, spawnTarget.argv, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env,
      windowsHide: spawnTarget.windowsHide
    });
    let stdout = "";
    let stdoutBytes = 0;
    let stderr = "";
    let settled = false;
    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (result.ok) {
        resolve(result.value);
      } else {
        reject(result.error);
      }
    };
    const failAndTerminate = (message) => {
      try {
        child.kill("SIGKILL");
      } finally {
        settle({ ok: false, error: new Error(message) });
      }
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      const str = String(chunk);
      stdoutBytes += Buffer.byteLength(str, "utf8");
      if (stdoutBytes > maxStdoutBytes) {
        failAndTerminate("lobster output exceeded maxStdoutBytes");
        return;
      }
      stdout += str;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      failAndTerminate("lobster subprocess timed out");
    }, timeoutMs);
    child.once("error", (err) => {
      settle({ ok: false, error: err });
    });
    child.once("exit", (code) => {
      if (code !== 0) {
        settle({
          ok: false,
          error: new Error(`lobster failed (${code ?? "?"}): ${stderr.trim() || stdout.trim()}`)
        });
        return;
      }
      settle({ ok: true, value: { stdout } });
    });
  });
}
function parseEnvelope(stdout) {
  const trimmed = stdout.trim();
  const tryParse = (input) => {
    try {
      return JSON.parse(input);
    } catch {
      return void 0;
    }
  };
  let parsed = tryParse(trimmed);
  if (parsed === void 0) {
    const suffixMatch = trimmed.match(/({[\s\S]*}|\[[\s\S]*])\s*$/);
    if (suffixMatch?.[1]) {
      parsed = tryParse(suffixMatch[1]);
    }
  }
  if (parsed === void 0) {
    throw new Error("lobster returned invalid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("lobster returned invalid JSON envelope");
  }
  const ok = parsed.ok;
  if (ok === true || ok === false) {
    return parsed;
  }
  throw new Error("lobster returned invalid JSON envelope");
}
function buildLobsterArgv(action, params) {
  if (action === "run") {
    const pipeline = typeof params.pipeline === "string" ? params.pipeline : "";
    if (!pipeline.trim()) {
      throw new Error("pipeline required");
    }
    const argv = ["run", "--mode", "tool", pipeline];
    const argsJson = typeof params.argsJson === "string" ? params.argsJson : "";
    if (argsJson.trim()) {
      argv.push("--args-json", argsJson);
    }
    return argv;
  }
  if (action === "resume") {
    const token = typeof params.token === "string" ? params.token : "";
    if (!token.trim()) {
      throw new Error("token required");
    }
    const approve = params.approve;
    if (typeof approve !== "boolean") {
      throw new Error("approve required");
    }
    return ["resume", "--token", token, "--approve", approve ? "yes" : "no"];
  }
  throw new Error(`Unknown action: ${action}`);
}
function createLobsterTool(api) {
  return {
    name: "lobster",
    label: "Lobster Workflow",
    description: "Run Lobster pipelines as a local-first workflow runtime (typed JSON envelope + resumable approvals).",
    parameters: import_typebox.Type.Object({
      // NOTE: Prefer string enums in tool schemas; some providers reject unions/anyOf.
      action: import_typebox.Type.Unsafe({ type: "string", enum: ["run", "resume"] }),
      pipeline: import_typebox.Type.Optional(import_typebox.Type.String()),
      argsJson: import_typebox.Type.Optional(import_typebox.Type.String()),
      token: import_typebox.Type.Optional(import_typebox.Type.String()),
      approve: import_typebox.Type.Optional(import_typebox.Type.Boolean()),
      cwd: import_typebox.Type.Optional(
        import_typebox.Type.String({
          description: "Relative working directory (optional). Must stay within the gateway working directory."
        })
      ),
      timeoutMs: import_typebox.Type.Optional(import_typebox.Type.Number()),
      maxStdoutBytes: import_typebox.Type.Optional(import_typebox.Type.Number())
    }),
    async execute(_id, params) {
      const action = typeof params.action === "string" ? params.action.trim() : "";
      if (!action) {
        throw new Error("action required");
      }
      const execPath = "lobster";
      const cwd = resolveCwd(params.cwd);
      const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 2e4;
      const maxStdoutBytes = typeof params.maxStdoutBytes === "number" ? params.maxStdoutBytes : 512e3;
      const argv = buildLobsterArgv(action, params);
      if (api.runtime?.version && api.logger?.debug) {
        api.logger.debug(`lobster plugin runtime=${api.runtime.version}`);
      }
      const { stdout } = await runLobsterSubprocessOnce({
        execPath,
        argv,
        cwd,
        timeoutMs,
        maxStdoutBytes
      });
      const envelope = parseEnvelope(stdout);
      return {
        content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }],
        details: envelope
      };
    }
  };
}

// src/core/extensions/lobster/index.ts
function register(api) {
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api);
    },
    { optional: true }
  );
}
