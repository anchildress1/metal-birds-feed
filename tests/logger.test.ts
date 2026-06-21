import { describe, it, expect, mock, spyOn, afterEach } from 'bun:test';
import * as actualFs from 'node:fs';

const mockAppendFileSync = mock();
const mockMkdirSync = mock();

void mock.module('node:fs', () => ({
  ...actualFs,
  appendFileSync: mockAppendFileSync,
  mkdirSync: mockMkdirSync,
}));

const { log } = await import('../src/logger.js');

afterEach(() => {
  mock.restore();
  mockAppendFileSync.mockReset();
});

describe('log', () => {
  it('includes level, event, and timestamp', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'test_event');
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain('level=info');
    expect(output).toContain('event=test_event');
    expect(output).toMatch(/ts=\d{4}-\d{2}-\d{2}T/);
  });

  it('serializes numeric fields', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'test_event', { count: 42 });
    expect(spy.mock.calls[0]?.[0]).toContain('count=42');
  });

  it('serializes boolean fields', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'test_event', { dry_run: true });
    expect(spy.mock.calls[0]?.[0]).toContain('dry_run=true');
  });

  it('serializes null field values as empty', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'test_event', { missing: null });
    expect(spy.mock.calls[0]?.[0]).toContain('missing=');
  });

  it('serializes object field values as escaped JSON', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'test_event', { data: { x: 1 } });
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain('\\"x\\"');
    expect(output).toContain(':1');
  });

  it('quotes string values that contain spaces', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('warn', 'test_event', { msg: 'hello world' });
    expect(spy.mock.calls[0]?.[0]).toContain('"hello world"');
  });

  it('escapes double-quotes inside field values', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('error', 'test_event', { msg: 'say "hi"' });
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain('\\"hi\\"');
  });

  it('handles undefined field values without throwing', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'test_event', { missing: undefined });
    expect(spy).toHaveBeenCalled();
  });

  it('serializes circular-reference objects without throwing', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => log('info', 'test_event', { obj: circular })).not.toThrow();
    expect(spy.mock.calls[0]?.[0]).toContain('obj=[Unserializable]');
  });

  it('does not throw when appendFileSync fails', () => {
    spyOn(console, 'log').mockImplementation(() => {});
    mockAppendFileSync.mockImplementationOnce(() => {
      throw new Error('EACCES');
    });
    expect(() => log('info', 'test_event')).not.toThrow();
  });
});
