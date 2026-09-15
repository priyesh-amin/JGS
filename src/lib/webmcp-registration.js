// WebMCP is optional. Current implementations use document.modelContext;
// earlier previews exposed navigator.modelContext instead.
export function detectWebMCP(doc, nav) {
  for (const [api, variant] of [[doc?.modelContext, 'document'], [nav?.modelContext, 'navigator']]) {
    if (typeof api?.registerTool === 'function') return { api, variant };
  }
  return null;
}

const registrationQueues = new WeakMap();

export function registerWebMCP(context, tools, onStatus = () => {}) {
  const controller = new AbortController();
  const registered = [];
  let active = true;
  const remove = name => {
    try { context.api.unregisterTool?.(name); } catch { /* Already removed by signal. */ }
  };
  const stop = () => {
    active = false;
    controller.abort();
    registered.splice(0).forEach(remove);
  };
  const previous = registrationQueues.get(context.api) || Promise.resolve();
  const ready = previous.catch(() => {}).then(async () => {
    try {
      for (const tool of tools) {
        if (!active) return;
        // The execution guard protects callbacks retained by older clients.
        await context.api.registerTool({ ...tool, execute: (...args) => {
          if (!active) throw new Error('This website session is no longer active. Refresh the page.');
          return tool.execute(...args);
        } }, { signal: controller.signal });
        if (!active) { remove(tool.name); return; }
        registered.push(tool.name);
      }
      if (active) onStatus({ state: 'ready', count: registered.length, variant: context.variant });
    } catch {
      stop();
      onStatus({ state: 'error', count: 0 });
    }
  });
  registrationQueues.set(context.api, ready);
  return { stop, ready };
}
