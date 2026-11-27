var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// signaling-worker.js
var handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const parts = path.split("/").filter((p) => p);
    const codigo = parts[parts.length - 1]?.toUpperCase() || "";
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    console.log("=== Request ===", request.method, path, "parts:", parts);
    if (parts[0] === "offer") {
      console.log(">>> MATCHED OFFER", request.method);
      if (request.method === "GET") {
        try {
          const data = await env.SIGNALING.get(`offer:${codigo}`);
          if (!data) return json({ error: "no offer yet", path }, 404, cors);
          return new Response(data, { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
      if (request.method === "POST") {
        try {
          const body = await request.json();
          if (!body || !body.sdp) {
            return json({ error: "sdp required" }, 400, cors);
          }
          await env.SIGNALING.put(`offer:${codigo}`, JSON.stringify({
            sdp: body.sdp,
            timestamp: Date.now()
          }), { expirationTtl: 600 });
          return json({ ok: true }, 200, cors);
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
    }
    if (parts[0] === "answer") {
      if (request.method === "GET") {
        try {
          const data = await env.SIGNALING.get(`answer:${codigo}`);
          if (!data) return json({ error: "no answer yet" }, 404, cors);
          return new Response(data, { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
      if (request.method === "POST") {
        try {
          const body = await request.json();
          if (!body || !body.sdp) {
            return json({ error: "sdp required" }, 400, cors);
          }
          await env.SIGNALING.put(`answer:${codigo}`, JSON.stringify({
            sdp: body.sdp,
            timestamp: Date.now()
          }), { expirationTtl: 600 });
          return json({ ok: true }, 200, cors);
        } catch (e) {
          return json({ error: e.message }, 500, cors);
        }
      }
    }
    if (path === "/health") {
      return new Response("OK", { headers: cors });
    }
    if (path.startsWith("/debug")) {
      return new Response(JSON.stringify({
        pathname: path,
        parts: path.split("/").filter((p) => p)
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (path === "/test-kv") {
      try {
        await env.SIGNALING.put("test:key", "test-value", { expirationTtl: 60 });
        const value = await env.SIGNALING.get("test:key");
        return new Response(JSON.stringify({ success: true, value }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    return new Response("Not found: " + path, { status: 404, headers: cors });
  }
};
function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}
__name(json, "json");
var signaling_worker_default = handler;
if (typeof module !== "undefined" && module.exports) {
  module.exports = handler;
}

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-scheduled.ts
var scheduled = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  const url = new URL(request.url);
  if (url.pathname === "/__scheduled") {
    const cron = url.searchParams.get("cron") ?? "";
    await middlewareCtx.dispatch("scheduled", { cron });
    return new Response("Ran scheduled event");
  }
  const resp = await middlewareCtx.next(request, env);
  if (request.headers.get("referer")?.endsWith("/__scheduled") && url.pathname === "/favicon.ico" && resp.status === 500) {
    return new Response(null, { status: 404 });
  }
  return resp;
}, "scheduled");
var middleware_scheduled_default = scheduled;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-nc9oR5/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_scheduled_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = signaling_worker_default;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-nc9oR5/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=signaling-worker.js.map
