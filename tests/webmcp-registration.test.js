import test from 'node:test';
import assert from 'node:assert/strict';
import { detectWebMCP, registerWebMCP } from '../src/lib/webmcp-registration.js';

test('feature detection prefers current API and falls back to legacy preview', () => {
  const api = { registerTool() {} };
  assert.equal(detectWebMCP({}, {}), null);
  assert.equal(detectWebMCP({ modelContext: api }, { modelContext: api }).variant, 'document');
  assert.equal(detectWebMCP({}, { modelContext: api }).variant, 'navigator');
});

test('session cleanup removes only owned tools and disables retained callbacks', async () => {
  const registered = [], removed = [], statuses = [];
  const lifecycle = registerWebMCP({ api: {
    registerTool(tool) { registered.push(tool); }, unregisterTool(name) { removed.push(name); },
  } }, [{ name: 'jgs_test', execute: () => 'ok' }], status => statuses.push(status));
  await lifecycle.ready;
  assert.equal(registered[0].execute(), 'ok');
  assert.equal(statuses[0].state, 'ready');
  lifecycle.stop();
  assert.deepEqual(removed, ['jgs_test']);
  assert.throws(() => registered[0].execute(), /no longer active/);
});

test('partial registration failure cleans up instead of advertising working tools', async () => {
  const removed = [], statuses = [];
  const lifecycle = registerWebMCP({ api: {
    registerTool(tool) { if (tool.name === 'bad') throw new Error('unsupported'); },
    unregisterTool(name) { removed.push(name); },
  } }, [{ name: 'good' }, { name: 'bad' }], state => statuses.push(state));
  await lifecycle.ready;
  assert.deepEqual(removed, ['good']);
  assert.equal(statuses[0].state, 'error');
});

test('logout during asynchronous registration removes the late tool', async () => {
  let finish;
  const removed = [];
  const lifecycle = registerWebMCP({ api: {
    registerTool() { return new Promise(resolve => { finish = resolve; }); },
    unregisterTool(name) { removed.push(name); },
  } }, [{ name: 'late' }]);
  await new Promise(resolve => setTimeout(resolve, 0));
  lifecycle.stop(); finish(); await lifecycle.ready;
  assert.deepEqual(removed, ['late']);
});


test('replacement waits for an old in-flight registration before reusing names', async () => {
  let finish;
  const entries = new Map();
  let calls = 0;
  const api = {
    async registerTool(tool) {
      calls++;
      if (calls === 1) await new Promise(resolve => { finish = resolve; });
      entries.set(tool.name, tool);
    },
    unregisterTool(name) { entries.delete(name); },
  };
  const old = registerWebMCP({ api }, [{ name: 'same', execute: () => 'old' }]);
  await new Promise(resolve => setTimeout(resolve, 0));
  old.stop();
  const replacement = registerWebMCP({ api }, [{ name: 'same', execute: () => 'new' }]);
  finish(); await old.ready; await replacement.ready;
  assert.equal(entries.get('same').execute(), 'new');
  replacement.stop();
});
