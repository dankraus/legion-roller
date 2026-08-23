export type SurgeOption = 'none' | 'hit' | 'crit';
export type DefenseSurgeOption = 'none' | 'block';
export type CoverOption = 'none' | 'light' | 'heavy';
export type DefenseColorOption = 'red' | 'white';

export interface UrlPoolState {
  r: number;
  b: number;
  w: number;
  surge: SurgeOption;
  crit: number;
  sTok: number;
  aim: number;
  obs: number;
  precise: number;
  ram: number;
  sharp: number;
  pierce: number;
  impact: number;
  downDef: number;
  cost: string;
  dColor: DefenseColorOption;
  dSurge: DefenseSurgeOption;
  dSurgeTok: number;
  dodge: number;
  shield: number;
  out: boolean;
  cover: CoverOption;
  dugIn: boolean;
  lowProf: boolean;
  sup: boolean;
  coverX: number;
  armor: number;
  imp: boolean;
  suppTok: number;
  danger: number;
  uLuck: number;
  backup: boolean;
}

export interface UrlState extends UrlPoolState {
  cmp: boolean;
  la: string;
  lb: string;
  a: UrlPoolState;
}

export const DEFAULT_URL_STATE_POOL: UrlPoolState = {
  r: 0,
  b: 0,
  w: 0,
  surge: 'none',
  crit: 0,
  sTok: 0,
  aim: 0,
  obs: 0,
  precise: 0,
  ram: 0,
  sharp: 0,
  pierce: 0,
  impact: 0,
  downDef: 0,
  cost: '',
  dColor: 'red',
  dSurge: 'none',
  dSurgeTok: 0,
  dodge: 0,
  shield: 0,
  out: false,
  cover: 'none',
  dugIn: false,
  lowProf: false,
  sup: false,
  coverX: 0,
  armor: 0,
  imp: false,
  suppTok: 0,
  danger: 0,
  uLuck: 0,
  backup: false,
};

export const DEFAULT_URL_STATE: UrlState = {
  ...DEFAULT_URL_STATE_POOL,
  cmp: false,
  la: 'A',
  lb: 'B',
  a: { ...DEFAULT_URL_STATE_POOL },
};

const SURGE_VALUES: SurgeOption[] = ['none', 'hit', 'crit'];
const COVER_VALUES: CoverOption[] = ['none', 'light', 'heavy'];
const D_SURGE_VALUES: DefenseSurgeOption[] = ['none', 'block'];
const D_COLOR_VALUES: DefenseColorOption[] = ['red', 'white'];

function parseNumber(value: string | null, defaultVal: number): number {
  if (value === null || value === '') return defaultVal;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return defaultVal;
  return Math.floor(parsed);
}

function parseEnum<T extends string>(
  value: string | null,
  options: readonly T[],
  defaultVal: T
): T {
  if (value === null || value === '') return defaultVal;
  return options.includes(value as T) ? (value as T) : defaultVal;
}

function parseBoolean(value: string | null): boolean {
  if (value === null || value === '') return false;
  const lower = value.toLowerCase();
  return lower === '1' || lower === 'true';
}

// The fragment key for dugIn is 'dug'; everything else uses its own name.
function poolKey(key: keyof UrlPoolState): string {
  return key === 'dugIn' ? 'dug' : key;
}

function parsePool(params: URLSearchParams, prefix: string): UrlPoolState {
  const get = (key: keyof UrlPoolState) => params.get(prefix + poolKey(key));
  return {
    r: parseNumber(get('r'), DEFAULT_URL_STATE_POOL.r),
    b: parseNumber(get('b'), DEFAULT_URL_STATE_POOL.b),
    w: parseNumber(get('w'), DEFAULT_URL_STATE_POOL.w),
    surge: parseEnum(get('surge'), SURGE_VALUES, DEFAULT_URL_STATE_POOL.surge),
    crit: parseNumber(get('crit'), DEFAULT_URL_STATE_POOL.crit),
    sTok: parseNumber(get('sTok'), DEFAULT_URL_STATE_POOL.sTok),
    aim: parseNumber(get('aim'), DEFAULT_URL_STATE_POOL.aim),
    obs: parseNumber(get('obs'), DEFAULT_URL_STATE_POOL.obs),
    precise: parseNumber(get('precise'), DEFAULT_URL_STATE_POOL.precise),
    ram: parseNumber(get('ram'), DEFAULT_URL_STATE_POOL.ram),
    sharp: parseNumber(get('sharp'), DEFAULT_URL_STATE_POOL.sharp),
    pierce: parseNumber(get('pierce'), DEFAULT_URL_STATE_POOL.pierce),
    impact: parseNumber(get('impact'), DEFAULT_URL_STATE_POOL.impact),
    downDef: parseNumber(get('downDef'), DEFAULT_URL_STATE_POOL.downDef),
    cost: get('cost') ?? DEFAULT_URL_STATE_POOL.cost,
    dColor: parseEnum(
      get('dColor'),
      D_COLOR_VALUES,
      DEFAULT_URL_STATE_POOL.dColor
    ),
    dSurge: parseEnum(
      get('dSurge'),
      D_SURGE_VALUES,
      DEFAULT_URL_STATE_POOL.dSurge
    ),
    dSurgeTok: parseNumber(get('dSurgeTok'), DEFAULT_URL_STATE_POOL.dSurgeTok),
    dodge: parseNumber(get('dodge'), DEFAULT_URL_STATE_POOL.dodge),
    shield: parseNumber(get('shield'), DEFAULT_URL_STATE_POOL.shield),
    out: parseBoolean(get('out')),
    cover: parseEnum(get('cover'), COVER_VALUES, DEFAULT_URL_STATE_POOL.cover),
    dugIn: parseBoolean(get('dugIn')),
    lowProf: parseBoolean(get('lowProf')),
    sup: parseBoolean(get('sup')),
    coverX: Math.min(
      2,
      Math.max(0, parseNumber(get('coverX'), DEFAULT_URL_STATE_POOL.coverX))
    ),
    armor: parseNumber(get('armor'), DEFAULT_URL_STATE_POOL.armor),
    imp: parseBoolean(get('imp')),
    suppTok: parseNumber(get('suppTok'), DEFAULT_URL_STATE_POOL.suppTok),
    danger: parseNumber(get('danger'), DEFAULT_URL_STATE_POOL.danger),
    uLuck: parseNumber(get('uLuck'), DEFAULT_URL_STATE_POOL.uLuck),
    backup: parseBoolean(get('backup')),
  };
}

export function parseFragment(hash: string): UrlState {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(stripped);

  const live = parsePool(params, '');
  const cmp = parseBoolean(params.get('cmp'));
  const a = cmp ? parsePool(params, 'a.') : { ...DEFAULT_URL_STATE_POOL };

  return {
    ...live,
    cmp,
    la: params.get('la') ?? DEFAULT_URL_STATE.la,
    lb: params.get('lb') ?? DEFAULT_URL_STATE.lb,
    a,
  };
}

function isDefaultPoolValue(
  key: keyof UrlPoolState,
  value: UrlPoolState[keyof UrlPoolState]
): boolean {
  return value === DEFAULT_URL_STATE_POOL[key];
}

function poolEntries(pool: UrlPoolState, prefix: string): string[] {
  const entries: string[] = [];
  const keys = Object.keys(DEFAULT_URL_STATE_POOL) as (keyof UrlPoolState)[];
  for (const key of keys) {
    const value = pool[key];
    if (!isDefaultPoolValue(key, value)) {
      const serialized =
        typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
      entries.push(
        `${prefix}${poolKey(key)}=${encodeURIComponent(serialized)}`
      );
    }
  }
  return entries;
}

export function buildFragment(state: UrlState): string {
  const entries: string[] = [...poolEntries(state, '')];

  if (state.cmp) {
    entries.push('cmp=1');
    if (state.la !== DEFAULT_URL_STATE.la)
      entries.push(`la=${encodeURIComponent(state.la)}`);
    if (state.lb !== DEFAULT_URL_STATE.lb)
      entries.push(`lb=${encodeURIComponent(state.lb)}`);
    entries.push(...poolEntries(state.a, 'a.'));
  }

  return entries.join('&');
}
