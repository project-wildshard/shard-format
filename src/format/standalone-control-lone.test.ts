import * as v from 'valibot';
import { expect, test } from 'vitest';
import { ShellMessageSchema } from './standaloneControl.ts';

const boot = { kind: 'boot', slug: 'far-reach', base: '/shardfiles/far-reach/', build: 'b', savePrefix: 'wildshard.', saves: {} } as const;

test('a boot says it is a lone cell, or says nothing', () => {
  expect(v.parse(ShellMessageSchema, boot)).toEqual(boot);
  expect(v.parse(ShellMessageSchema, { ...boot, lone: true })).toEqual({ ...boot, lone: true });
  expect(() => v.parse(ShellMessageSchema, { ...boot, lone: false })).toThrow();
});
