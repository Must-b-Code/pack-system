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

// src/core/extensions/diagnostics-otel/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_diagnostics_otel2 = require("src/core/source/plugin-sdk/diagnostics-otel");

// src/core/extensions/diagnostics-otel/src/service.ts
var import_api = require("@opentelemetry/api");
var import_exporter_logs_otlp_proto = require("@opentelemetry/exporter-logs-otlp-proto");
var import_exporter_metrics_otlp_proto = require("@opentelemetry/exporter-metrics-otlp-proto");
var import_exporter_trace_otlp_proto = require("@opentelemetry/exporter-trace-otlp-proto");
var import_resources = require("@opentelemetry/resources");
var import_sdk_logs = require("@opentelemetry/sdk-logs");
var import_sdk_metrics = require("@opentelemetry/sdk-metrics");
var import_sdk_node = require("@opentelemetry/sdk-node");
var import_sdk_trace_base = require("@opentelemetry/sdk-trace-base");
var import_semantic_conventions = require("@opentelemetry/semantic-conventions");
var import_diagnostics_otel = require("src/core/source/plugin-sdk/diagnostics-otel");
var DEFAULT_SERVICE_NAME = "must-b";
function normalizeEndpoint(endpoint) {
  const trimmed = endpoint?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : void 0;
}
function resolveOtelUrl(endpoint, path) {
  if (!endpoint) {
    return void 0;
  }
  const endpointWithoutQueryOrFragment = endpoint.split(/[?#]/, 1)[0] ?? endpoint;
  if (/\/v1\/(?:traces|metrics|logs)$/i.test(endpointWithoutQueryOrFragment)) {
    return endpoint;
  }
  return `${endpoint}/${path}`;
}
function resolveSampleRate(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return void 0;
  }
  if (value < 0 || value > 1) {
    return void 0;
  }
  return value;
}
function formatError(err) {
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
function redactOtelAttributes(attributes) {
  const redactedAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    redactedAttributes[key] = typeof value === "string" ? (0, import_diagnostics_otel.redactSensitiveText)(value) : value;
  }
  return redactedAttributes;
}
function createDiagnosticsOtelService() {
  let sdk = null;
  let logProvider = null;
  let stopLogTransport = null;
  let unsubscribe = null;
  return {
    id: "diagnostics-otel",
    async start(ctx) {
      const cfg = ctx.config.diagnostics;
      const otel = cfg?.otel;
      if (!cfg?.enabled || !otel?.enabled) {
        return;
      }
      const protocol = otel.protocol ?? process.env.OTEL_EXPORTER_OTLP_PROTOCOL ?? "http/protobuf";
      if (protocol !== "http/protobuf") {
        ctx.logger.warn(`diagnostics-otel: unsupported protocol ${protocol}`);
        return;
      }
      const endpoint = normalizeEndpoint(otel.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
      const headers = otel.headers ?? void 0;
      const serviceName = otel.serviceName?.trim() || process.env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME;
      const sampleRate = resolveSampleRate(otel.sampleRate);
      const tracesEnabled = otel.traces !== false;
      const metricsEnabled = otel.metrics !== false;
      const logsEnabled = otel.logs === true;
      if (!tracesEnabled && !metricsEnabled && !logsEnabled) {
        return;
      }
      const resource = (0, import_resources.resourceFromAttributes)({
        [import_semantic_conventions.ATTR_SERVICE_NAME]: serviceName
      });
      const traceUrl = resolveOtelUrl(endpoint, "v1/traces");
      const metricUrl = resolveOtelUrl(endpoint, "v1/metrics");
      const logUrl = resolveOtelUrl(endpoint, "v1/logs");
      const traceExporter = tracesEnabled ? new import_exporter_trace_otlp_proto.OTLPTraceExporter({
        ...traceUrl ? { url: traceUrl } : {},
        ...headers ? { headers } : {}
      }) : void 0;
      const metricExporter = metricsEnabled ? new import_exporter_metrics_otlp_proto.OTLPMetricExporter({
        ...metricUrl ? { url: metricUrl } : {},
        ...headers ? { headers } : {}
      }) : void 0;
      const metricReader = metricExporter ? new import_sdk_metrics.PeriodicExportingMetricReader({
        exporter: metricExporter,
        ...typeof otel.flushIntervalMs === "number" ? { exportIntervalMillis: Math.max(1e3, otel.flushIntervalMs) } : {}
      }) : void 0;
      if (tracesEnabled || metricsEnabled) {
        sdk = new import_sdk_node.NodeSDK({
          resource,
          ...traceExporter ? { traceExporter } : {},
          ...metricReader ? { metricReader } : {},
          ...sampleRate !== void 0 ? {
            sampler: new import_sdk_trace_base.ParentBasedSampler({
              root: new import_sdk_trace_base.TraceIdRatioBasedSampler(sampleRate)
            })
          } : {}
        });
        try {
          await sdk.start();
        } catch (err) {
          ctx.logger.error(`diagnostics-otel: failed to start SDK: ${formatError(err)}`);
          throw err;
        }
      }
      const logSeverityMap = {
        TRACE: 1,
        DEBUG: 5,
        INFO: 9,
        WARN: 13,
        ERROR: 17,
        FATAL: 21
      };
      const meter = import_api.metrics.getMeter("must-b");
      const tracer = import_api.trace.getTracer("must-b");
      const tokensCounter = meter.createCounter("must-b.tokens", {
        unit: "1",
        description: "Token usage by type"
      });
      const costCounter = meter.createCounter("must-b.cost.usd", {
        unit: "1",
        description: "Estimated model cost (USD)"
      });
      const durationHistogram = meter.createHistogram("must-b.run.duration_ms", {
        unit: "ms",
        description: "Agent run duration"
      });
      const contextHistogram = meter.createHistogram("must-b.context.tokens", {
        unit: "1",
        description: "Context window size and usage"
      });
      const webhookReceivedCounter = meter.createCounter("must-b.webhook.received", {
        unit: "1",
        description: "Webhook requests received"
      });
      const webhookErrorCounter = meter.createCounter("must-b.webhook.error", {
        unit: "1",
        description: "Webhook processing errors"
      });
      const webhookDurationHistogram = meter.createHistogram("must-b.webhook.duration_ms", {
        unit: "ms",
        description: "Webhook processing duration"
      });
      const messageQueuedCounter = meter.createCounter("must-b.message.queued", {
        unit: "1",
        description: "Messages queued for processing"
      });
      const messageProcessedCounter = meter.createCounter("must-b.message.processed", {
        unit: "1",
        description: "Messages processed by outcome"
      });
      const messageDurationHistogram = meter.createHistogram("must-b.message.duration_ms", {
        unit: "ms",
        description: "Message processing duration"
      });
      const queueDepthHistogram = meter.createHistogram("must-b.queue.depth", {
        unit: "1",
        description: "Queue depth on enqueue/dequeue"
      });
      const queueWaitHistogram = meter.createHistogram("must-b.queue.wait_ms", {
        unit: "ms",
        description: "Queue wait time before execution"
      });
      const laneEnqueueCounter = meter.createCounter("must-b.queue.lane.enqueue", {
        unit: "1",
        description: "Command queue lane enqueue events"
      });
      const laneDequeueCounter = meter.createCounter("must-b.queue.lane.dequeue", {
        unit: "1",
        description: "Command queue lane dequeue events"
      });
      const sessionStateCounter = meter.createCounter("must-b.session.state", {
        unit: "1",
        description: "Session state transitions"
      });
      const sessionStuckCounter = meter.createCounter("must-b.session.stuck", {
        unit: "1",
        description: "Sessions stuck in processing"
      });
      const sessionStuckAgeHistogram = meter.createHistogram("must-b.session.stuck_age_ms", {
        unit: "ms",
        description: "Age of stuck sessions"
      });
      const runAttemptCounter = meter.createCounter("must-b.run.attempt", {
        unit: "1",
        description: "Run attempts"
      });
      if (logsEnabled) {
        const logExporter = new import_exporter_logs_otlp_proto.OTLPLogExporter({
          ...logUrl ? { url: logUrl } : {},
          ...headers ? { headers } : {}
        });
        const logProcessor = new import_sdk_logs.BatchLogRecordProcessor(
          logExporter,
          typeof otel.flushIntervalMs === "number" ? { scheduledDelayMillis: Math.max(1e3, otel.flushIntervalMs) } : {}
        );
        logProvider = new import_sdk_logs.LoggerProvider({
          resource,
          processors: [logProcessor]
        });
        const otelLogger = logProvider.getLogger("must-b");
        stopLogTransport = (0, import_diagnostics_otel.registerLogTransport)((logObj) => {
          try {
            const safeStringify = (value) => {
              try {
                return JSON.stringify(value);
              } catch {
                return String(value);
              }
            };
            const meta = logObj._meta;
            const logLevelName = meta?.logLevelName ?? "INFO";
            const severityNumber = logSeverityMap[logLevelName] ?? 9;
            const numericArgs = Object.entries(logObj).filter(([key]) => /^\d+$/.test(key)).toSorted((a, b) => Number(a[0]) - Number(b[0])).map(([, value]) => value);
            let bindings;
            if (typeof numericArgs[0] === "string" && numericArgs[0].trim().startsWith("{")) {
              try {
                const parsed = JSON.parse(numericArgs[0]);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  bindings = parsed;
                  numericArgs.shift();
                }
              } catch {
              }
            }
            let message = "";
            if (numericArgs.length > 0 && typeof numericArgs[numericArgs.length - 1] === "string") {
              message = String(numericArgs.pop());
            } else if (numericArgs.length === 1) {
              message = safeStringify(numericArgs[0]);
              numericArgs.length = 0;
            }
            if (!message) {
              message = "log";
            }
            const attributes = {
              "must-b.log.level": logLevelName
            };
            if (meta?.name) {
              attributes["must-b.logger"] = meta.name;
            }
            if (meta?.parentNames?.length) {
              attributes["must-b.logger.parents"] = meta.parentNames.join(".");
            }
            if (bindings) {
              for (const [key, value] of Object.entries(bindings)) {
                if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                  attributes[`must-b.${key}`] = value;
                } else if (value != null) {
                  attributes[`must-b.${key}`] = safeStringify(value);
                }
              }
            }
            if (numericArgs.length > 0) {
              attributes["must-b.log.args"] = safeStringify(numericArgs);
            }
            if (meta?.path?.filePath) {
              attributes["code.filepath"] = meta.path.filePath;
            }
            if (meta?.path?.fileLine) {
              attributes["code.lineno"] = Number(meta.path.fileLine);
            }
            if (meta?.path?.method) {
              attributes["code.function"] = meta.path.method;
            }
            if (meta?.path?.filePathWithLine) {
              attributes["must-b.code.location"] = meta.path.filePathWithLine;
            }
            otelLogger.emit({
              body: (0, import_diagnostics_otel.redactSensitiveText)(message),
              severityText: logLevelName,
              severityNumber,
              attributes: redactOtelAttributes(attributes),
              timestamp: meta?.date ?? /* @__PURE__ */ new Date()
            });
          } catch (err) {
            ctx.logger.error(`diagnostics-otel: log transport failed: ${formatError(err)}`);
          }
        });
      }
      const spanWithDuration = (name, attributes, durationMs) => {
        const startTime = typeof durationMs === "number" ? Date.now() - Math.max(0, durationMs) : void 0;
        const span = tracer.startSpan(name, {
          attributes,
          ...startTime ? { startTime } : {}
        });
        return span;
      };
      const recordModelUsage = (evt) => {
        const attrs = {
          "must-b.channel": evt.channel ?? "unknown",
          "must-b.provider": evt.provider ?? "unknown",
          "must-b.model": evt.model ?? "unknown"
        };
        const usage = evt.usage;
        if (usage.input) {
          tokensCounter.add(usage.input, { ...attrs, "must-b.token": "input" });
        }
        if (usage.output) {
          tokensCounter.add(usage.output, { ...attrs, "must-b.token": "output" });
        }
        if (usage.cacheRead) {
          tokensCounter.add(usage.cacheRead, { ...attrs, "must-b.token": "cache_read" });
        }
        if (usage.cacheWrite) {
          tokensCounter.add(usage.cacheWrite, { ...attrs, "must-b.token": "cache_write" });
        }
        if (usage.promptTokens) {
          tokensCounter.add(usage.promptTokens, { ...attrs, "must-b.token": "prompt" });
        }
        if (usage.total) {
          tokensCounter.add(usage.total, { ...attrs, "must-b.token": "total" });
        }
        if (evt.costUsd) {
          costCounter.add(evt.costUsd, attrs);
        }
        if (evt.durationMs) {
          durationHistogram.record(evt.durationMs, attrs);
        }
        if (evt.context?.limit) {
          contextHistogram.record(evt.context.limit, {
            ...attrs,
            "must-b.context": "limit"
          });
        }
        if (evt.context?.used) {
          contextHistogram.record(evt.context.used, {
            ...attrs,
            "must-b.context": "used"
          });
        }
        if (!tracesEnabled) {
          return;
        }
        const spanAttrs = {
          ...attrs,
          "must-b.sessionKey": evt.sessionKey ?? "",
          "must-b.sessionId": evt.sessionId ?? "",
          "must-b.tokens.input": usage.input ?? 0,
          "must-b.tokens.output": usage.output ?? 0,
          "must-b.tokens.cache_read": usage.cacheRead ?? 0,
          "must-b.tokens.cache_write": usage.cacheWrite ?? 0,
          "must-b.tokens.total": usage.total ?? 0
        };
        const span = spanWithDuration("must-b.model.usage", spanAttrs, evt.durationMs);
        span.end();
      };
      const recordWebhookReceived = (evt) => {
        const attrs = {
          "must-b.channel": evt.channel ?? "unknown",
          "must-b.webhook": evt.updateType ?? "unknown"
        };
        webhookReceivedCounter.add(1, attrs);
      };
      const recordWebhookProcessed = (evt) => {
        const attrs = {
          "must-b.channel": evt.channel ?? "unknown",
          "must-b.webhook": evt.updateType ?? "unknown"
        };
        if (typeof evt.durationMs === "number") {
          webhookDurationHistogram.record(evt.durationMs, attrs);
        }
        if (!tracesEnabled) {
          return;
        }
        const spanAttrs = { ...attrs };
        if (evt.chatId !== void 0) {
          spanAttrs["must-b.chatId"] = String(evt.chatId);
        }
        const span = spanWithDuration("must-b.webhook.processed", spanAttrs, evt.durationMs);
        span.end();
      };
      const recordWebhookError = (evt) => {
        const attrs = {
          "must-b.channel": evt.channel ?? "unknown",
          "must-b.webhook": evt.updateType ?? "unknown"
        };
        webhookErrorCounter.add(1, attrs);
        if (!tracesEnabled) {
          return;
        }
        const redactedError = (0, import_diagnostics_otel.redactSensitiveText)(evt.error);
        const spanAttrs = {
          ...attrs,
          "must-b.error": redactedError
        };
        if (evt.chatId !== void 0) {
          spanAttrs["must-b.chatId"] = String(evt.chatId);
        }
        const span = tracer.startSpan("must-b.webhook.error", {
          attributes: spanAttrs
        });
        span.setStatus({ code: import_api.SpanStatusCode.ERROR, message: redactedError });
        span.end();
      };
      const recordMessageQueued = (evt) => {
        const attrs = {
          "must-b.channel": evt.channel ?? "unknown",
          "must-b.source": evt.source ?? "unknown"
        };
        messageQueuedCounter.add(1, attrs);
        if (typeof evt.queueDepth === "number") {
          queueDepthHistogram.record(evt.queueDepth, attrs);
        }
      };
      const addSessionIdentityAttrs = (spanAttrs, evt) => {
        if (evt.sessionKey) {
          spanAttrs["must-b.sessionKey"] = evt.sessionKey;
        }
        if (evt.sessionId) {
          spanAttrs["must-b.sessionId"] = evt.sessionId;
        }
      };
      const recordMessageProcessed = (evt) => {
        const attrs = {
          "must-b.channel": evt.channel ?? "unknown",
          "must-b.outcome": evt.outcome ?? "unknown"
        };
        messageProcessedCounter.add(1, attrs);
        if (typeof evt.durationMs === "number") {
          messageDurationHistogram.record(evt.durationMs, attrs);
        }
        if (!tracesEnabled) {
          return;
        }
        const spanAttrs = { ...attrs };
        addSessionIdentityAttrs(spanAttrs, evt);
        if (evt.chatId !== void 0) {
          spanAttrs["must-b.chatId"] = String(evt.chatId);
        }
        if (evt.messageId !== void 0) {
          spanAttrs["must-b.messageId"] = String(evt.messageId);
        }
        if (evt.reason) {
          spanAttrs["must-b.reason"] = (0, import_diagnostics_otel.redactSensitiveText)(evt.reason);
        }
        const span = spanWithDuration("must-b.message.processed", spanAttrs, evt.durationMs);
        if (evt.outcome === "error" && evt.error) {
          span.setStatus({ code: import_api.SpanStatusCode.ERROR, message: (0, import_diagnostics_otel.redactSensitiveText)(evt.error) });
        }
        span.end();
      };
      const recordLaneEnqueue = (evt) => {
        const attrs = { "must-b.lane": evt.lane };
        laneEnqueueCounter.add(1, attrs);
        queueDepthHistogram.record(evt.queueSize, attrs);
      };
      const recordLaneDequeue = (evt) => {
        const attrs = { "must-b.lane": evt.lane };
        laneDequeueCounter.add(1, attrs);
        queueDepthHistogram.record(evt.queueSize, attrs);
        if (typeof evt.waitMs === "number") {
          queueWaitHistogram.record(evt.waitMs, attrs);
        }
      };
      const recordSessionState = (evt) => {
        const attrs = { "must-b.state": evt.state };
        if (evt.reason) {
          attrs["must-b.reason"] = (0, import_diagnostics_otel.redactSensitiveText)(evt.reason);
        }
        sessionStateCounter.add(1, attrs);
      };
      const recordSessionStuck = (evt) => {
        const attrs = { "must-b.state": evt.state };
        sessionStuckCounter.add(1, attrs);
        if (typeof evt.ageMs === "number") {
          sessionStuckAgeHistogram.record(evt.ageMs, attrs);
        }
        if (!tracesEnabled) {
          return;
        }
        const spanAttrs = { ...attrs };
        addSessionIdentityAttrs(spanAttrs, evt);
        spanAttrs["must-b.queueDepth"] = evt.queueDepth ?? 0;
        spanAttrs["must-b.ageMs"] = evt.ageMs;
        const span = tracer.startSpan("must-b.session.stuck", { attributes: spanAttrs });
        span.setStatus({ code: import_api.SpanStatusCode.ERROR, message: "session stuck" });
        span.end();
      };
      const recordRunAttempt = (evt) => {
        runAttemptCounter.add(1, { "must-b.attempt": evt.attempt });
      };
      const recordHeartbeat = (evt) => {
        queueDepthHistogram.record(evt.queued, { "must-b.channel": "heartbeat" });
      };
      unsubscribe = (0, import_diagnostics_otel.onDiagnosticEvent)((evt) => {
        try {
          switch (evt.type) {
            case "model.usage":
              recordModelUsage(evt);
              return;
            case "webhook.received":
              recordWebhookReceived(evt);
              return;
            case "webhook.processed":
              recordWebhookProcessed(evt);
              return;
            case "webhook.error":
              recordWebhookError(evt);
              return;
            case "message.queued":
              recordMessageQueued(evt);
              return;
            case "message.processed":
              recordMessageProcessed(evt);
              return;
            case "queue.lane.enqueue":
              recordLaneEnqueue(evt);
              return;
            case "queue.lane.dequeue":
              recordLaneDequeue(evt);
              return;
            case "session.state":
              recordSessionState(evt);
              return;
            case "session.stuck":
              recordSessionStuck(evt);
              return;
            case "run.attempt":
              recordRunAttempt(evt);
              return;
            case "diagnostic.heartbeat":
              recordHeartbeat(evt);
              return;
          }
        } catch (err) {
          ctx.logger.error(
            `diagnostics-otel: event handler failed (${evt.type}): ${formatError(err)}`
          );
        }
      });
      if (logsEnabled) {
        ctx.logger.info("diagnostics-otel: logs exporter enabled (OTLP/Protobuf)");
      }
    },
    async stop() {
      unsubscribe?.();
      unsubscribe = null;
      stopLogTransport?.();
      stopLogTransport = null;
      if (logProvider) {
        await logProvider.shutdown().catch(() => void 0);
        logProvider = null;
      }
      if (sdk) {
        await sdk.shutdown().catch(() => void 0);
        sdk = null;
      }
    }
  };
}

// src/core/extensions/diagnostics-otel/index.ts
var plugin = {
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  configSchema: (0, import_diagnostics_otel2.emptyPluginConfigSchema)(),
  register(api) {
    api.registerService(createDiagnosticsOtelService());
  }
};
var index_default = plugin;
