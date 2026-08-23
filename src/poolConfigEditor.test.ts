import { describe, it, expect, vi } from 'vitest';
import {
  readConfigFromEditor,
  applyConfigToEditor,
  configToUrlPoolState,
} from './poolConfigEditor';
import { DEFAULT_POOL_CONFIG } from './poolResults';
import type { PoolConfig } from './types';

describe('readConfigFromEditor', () => {
  it('returns a PoolConfig copy of editor inputs', () => {
    const inputs: PoolConfig = {
      ...DEFAULT_POOL_CONFIG,
      pool: { red: 3, black: 1, white: 0 },
      aimTokens: '2',
    };
    expect(readConfigFromEditor(inputs)).toEqual(inputs);
  });
});

describe('applyConfigToEditor', () => {
  it('calls all setters with config values', () => {
    const config: PoolConfig = {
      ...DEFAULT_POOL_CONFIG,
      pool: { red: 2, black: 0, white: 1 },
      surge: 'crit',
      aimTokens: '1',
      cover: 'light',
      backup: true,
    };
    const setters = {
      setPool: vi.fn(),
      setSurge: vi.fn(),
      setCriticalX: vi.fn(),
      setSurgeTokens: vi.fn(),
      setAimTokens: vi.fn(),
      setObserveTokens: vi.fn(),
      setPreciseX: vi.fn(),
      setRamX: vi.fn(),
      setSharpshooterX: vi.fn(),
      setPierceX: vi.fn(),
      setImpactX: vi.fn(),
      setDowngradeDefenseX: vi.fn(),
      setPointCost: vi.fn(),
      setDefenseDieColor: vi.fn(),
      setDefenseSurge: vi.fn(),
      setDefenseSurgeTokens: vi.fn(),
      setDodgeTokens: vi.fn(),
      setShieldTokens: vi.fn(),
      setOutmaneuver: vi.fn(),
      setCover: vi.fn(),
      setDugIn: vi.fn(),
      setLowProfile: vi.fn(),
      setSuppressed: vi.fn(),
      setCoverX: vi.fn(),
      setArmorX: vi.fn(),
      setImpervious: vi.fn(),
      setSuppressionTokens: vi.fn(),
      setDangerSenseX: vi.fn(),
      setUncannyLuckX: vi.fn(),
      setBackup: vi.fn(),
    };
    applyConfigToEditor(config, setters);
    expect(setters.setPool).toHaveBeenCalledWith({
      red: 2,
      black: 0,
      white: 1,
    });
    expect(setters.setSurge).toHaveBeenCalledWith('crit');
    expect(setters.setAimTokens).toHaveBeenCalledWith('1');
    expect(setters.setCover).toHaveBeenCalledWith('light');
    expect(setters.setBackup).toHaveBeenCalledWith(true);
  });
});

describe('configToUrlPoolState', () => {
  it('maps PoolConfig to UrlPoolState numeric fields', () => {
    const state = configToUrlPoolState({
      ...DEFAULT_POOL_CONFIG,
      pool: { red: 3, black: 0, white: 0 },
      aimTokens: '2',
      coverX: '3', // clamped to 2
    });
    expect(state.r).toBe(3);
    expect(state.aim).toBe(2);
    expect(state.coverX).toBe(2);
  });
});
