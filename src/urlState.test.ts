import { describe, it, expect } from 'vitest';
import {
  parseFragment,
  buildFragment,
  DEFAULT_URL_STATE,
  DEFAULT_URL_STATE_POOL,
  type UrlState,
} from './urlState';

describe('urlState', () => {
  describe('parseFragment', () => {
    it('returns default state for empty string', () => {
      expect(parseFragment('')).toEqual(DEFAULT_URL_STATE);
    });

    it('returns default state for hash only', () => {
      expect(parseFragment('#')).toEqual(DEFAULT_URL_STATE);
    });

    it('parses r and b and keeps rest default', () => {
      const result = parseFragment('#r=2&b=1');
      expect(result.r).toBe(2);
      expect(result.b).toBe(1);
      expect(result.w).toBe(0);
      expect(result.surge).toBe('none');
    });

    it('validates surge enum and falls back to none for invalid', () => {
      expect(parseFragment('#surge=invalid').surge).toBe('none');
      expect(parseFragment('#surge=hit').surge).toBe('hit');
      expect(parseFragment('#surge=crit').surge).toBe('crit');
    });

    it('validates cover enum and falls back to none for invalid', () => {
      expect(parseFragment('#cover=invalid').cover).toBe('none');
      expect(parseFragment('#cover=light').cover).toBe('light');
      expect(parseFragment('#cover=heavy').cover).toBe('heavy');
    });

    it('validates dSurge enum and falls back to none for invalid', () => {
      expect(parseFragment('#dSurge=invalid').dSurge).toBe('none');
      expect(parseFragment('#dSurge=block').dSurge).toBe('block');
    });

    it('validates dColor enum and falls back to red for invalid', () => {
      expect(parseFragment('#dColor=invalid').dColor).toBe('red');
      expect(parseFragment('#dColor=white').dColor).toBe('white');
    });

    it('parses boolean out=1 as true and out=0 as false', () => {
      expect(parseFragment('#out=1').out).toBe(true);
      expect(parseFragment('#out=0').out).toBe(false);
      expect(parseFragment('#out=true').out).toBe(true);
      expect(parseFragment('#out=yes').out).toBe(false);
    });

    it('ignores unknown keys in hash', () => {
      const result = parseFragment('#r=1&unknown=foo&b=2');
      expect(result.r).toBe(1);
      expect(result.b).toBe(2);
      expect('unknown' in result).toBe(false);
    });

    it('parses uLuck and roundtrips in buildFragment', () => {
      const parsed = parseFragment('#uLuck=3');
      expect(parsed.uLuck).toBe(3);
      const fragment = buildFragment({ ...DEFAULT_URL_STATE, uLuck: 3 });
      expect(fragment).toContain('uLuck=3');
      expect(parseFragment('#' + fragment).uLuck).toBe(3);
    });

    it('parses downDef and roundtrips in buildFragment', () => {
      const parsed = parseFragment('#downDef=2');
      expect(parsed.downDef).toBe(2);
      const fragment = buildFragment({ ...DEFAULT_URL_STATE, downDef: 2 });
      expect(fragment).toContain('downDef=2');
      expect(parseFragment('#' + fragment).downDef).toBe(2);
    });

    it('omits downDef from the fragment when it is 0', () => {
      const fragment = buildFragment({ ...DEFAULT_URL_STATE, downDef: 0 });
      expect(fragment).not.toContain('downDef');
    });
  });

  describe('buildFragment', () => {
    it('returns empty string for default state', () => {
      expect(buildFragment(DEFAULT_URL_STATE)).toBe('');
    });

    it('roundtrips non-default state', () => {
      const state: UrlState = {
        ...DEFAULT_URL_STATE,
        r: 2,
        b: 1,
        surge: 'hit',
        cover: 'light',
        out: true,
      };
      const fragment = buildFragment(state);
      expect(fragment).not.toBe('');
      const parsed = parseFragment('#' + fragment);
      expect(parsed.r).toBe(state.r);
      expect(parsed.b).toBe(state.b);
      expect(parsed.surge).toBe(state.surge);
      expect(parsed.cover).toBe(state.cover);
      expect(parsed.out).toBe(state.out);
    });
  });

  describe('comparison state', () => {
    it('roundtrips a pinned pool A under a. prefix with cmp flag and labels', () => {
      const state: UrlState = {
        ...DEFAULT_URL_STATE,
        r: 1,
        cmp: true,
        la: 'DLT',
        lb: 'Stock',
        a: { ...DEFAULT_URL_STATE_POOL, r: 3, crit: 1, cover: 'light' },
      };
      const fragment = buildFragment(state);
      expect(fragment).toContain('cmp=1');
      expect(fragment).toContain('la=DLT');
      expect(fragment).toContain('a.r=3');
      expect(fragment).toContain('a.crit=1');

      const parsed = parseFragment('#' + fragment);
      expect(parsed.cmp).toBe(true);
      expect(parsed.la).toBe('DLT');
      expect(parsed.lb).toBe('Stock');
      expect(parsed.r).toBe(1);
      expect(parsed.a.r).toBe(3);
      expect(parsed.a.crit).toBe(1);
      expect(parsed.a.cover).toBe('light');
    });

    it('legacy links without cmp parse with compare off and default pool A', () => {
      const parsed = parseFragment('#r=2&b=1');
      expect(parsed.cmp).toBe(false);
      expect(parsed.r).toBe(2);
      expect(parsed.a).toEqual(DEFAULT_URL_STATE_POOL);
    });
  });
});
