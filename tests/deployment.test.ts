import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('Cloud Run deployment contract', () => {
  it('uploads the ignored generated database in the source deployment context', () => {
    const ignore = readFileSync('.gcloudignore', 'utf8');

    expect(ignore).toContain('#!include:.gitignore');
    expect(ignore.lastIndexOf('!feed.sqlite')).toBeGreaterThan(
      ignore.indexOf('#!include:.gitignore')
    );
  });

  it('leaves application authentication to FEED_TOKEN', () => {
    const makefile = readFileSync('Makefile', 'utf8');

    expect(makefile).toContain('--allow-unauthenticated');
    expect(makefile).not.toContain('--no-allow-unauthenticated');
  });
});
