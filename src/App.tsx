import { useState, useMemo, useEffect } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import {
  parseFragment,
  buildFragment,
  type UrlState,
  type UrlPoolState,
} from './urlState';
import type {
  AttackPool,
  SurgeConversion,
  DefenseDieColor,
  DefenseSurgeConversion,
  CoverLevel,
  PoolConfig,
} from './types';
import { computePoolResults } from './poolResults';
import { DiceSelector } from './components/DiceSelector';
import { AttackSurgeToggle } from './components/AttackSurgeToggle';
import { DefenseSurgeToggle } from './components/DefenseSurgeToggle';
import { DefenseDiceToggle } from './components/DefenseDiceToggle';
import { CoverToggle } from './components/CoverToggle';
import { CoverDiceToggle } from './components/CoverDiceToggle';
import { CheckboxToggle } from './components/CheckboxToggle';
import { NumberInputWithControls } from './components/NumberInputWithControls';
import { StatsSummary } from './components/StatsSummary';
import { DistributionChart } from './components/DistributionChart';
import { CumulativeCurve } from './components/CumulativeCurve';
import { ComparisonResults } from './components/ComparisonResults';
import { ComparePoolBar } from './components/ComparePoolBar';
import { RulebookVersion } from './components/RulebookVersion';
import { DiceRollerModal } from './components/DiceRollerModal';
import { ShareModal } from './components/ShareModal';
import {
  readConfigFromEditor,
  applyConfigToEditor,
  type PoolEditorSetters,
} from './poolConfigEditor';
import { resolveCompareConfigs, type ActivePool } from './comparePoolState';
import { buildAppUrlState } from './buildAppUrlState';
import './App.css';

const numToInput = (value: number): string =>
  value === 0 ? '' : String(value);

function poolStateToConfig(pool: UrlPoolState): PoolConfig {
  return {
    pool: { red: pool.r, black: pool.b, white: pool.w },
    surge: pool.surge,
    criticalX: numToInput(pool.crit),
    surgeTokens: numToInput(pool.sTok),
    aimTokens: numToInput(pool.aim),
    observeTokens: numToInput(pool.obs),
    preciseX: numToInput(pool.precise),
    ramX: numToInput(pool.ram),
    sharpshooterX: numToInput(pool.sharp),
    pierceX: numToInput(pool.pierce),
    impactX: numToInput(pool.impact),
    downgradeDefenseX: numToInput(pool.downDef),
    pointCost: pool.cost,
    defenseDieColor: pool.dColor,
    defenseSurge: pool.dSurge,
    defenseSurgeTokens: numToInput(pool.dSurgeTok),
    dodgeTokens: numToInput(pool.dodge),
    shieldTokens: numToInput(pool.shield),
    outmaneuver: pool.out,
    cover: pool.cover,
    coverDieColor: pool.cColor,
    lowProfile: pool.lowProf,
    suppressed: pool.sup,
    coverX: numToInput(pool.coverX),
    armorX: numToInput(pool.armor),
    impervious: pool.imp,
    suppressionTokens: numToInput(pool.suppTok),
    dangerSenseX: numToInput(pool.danger),
    uncannyLuckX: numToInput(pool.uLuck),
    upgradeDefenseX: numToInput(pool.upDef),
    backup: pool.backup,
  };
}

function App() {
  const initialFromUrl = useMemo(() => {
    const hash = window.location.hash;
    if (hash === '' || hash === '#') return null;
    return parseFragment(hash);
  }, []);

  const [pool, setPool] = useState<AttackPool>(() => ({
    red: initialFromUrl?.r ?? 0,
    black: initialFromUrl?.b ?? 0,
    white: initialFromUrl?.w ?? 0,
  }));
  const [surge, setSurge] = useState<SurgeConversion>(
    () => initialFromUrl?.surge ?? 'none'
  );
  const [criticalX, setCriticalX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.crit === 0
        ? ''
        : String(initialFromUrl.crit)
      : ''
  );
  const [surgeTokens, setSurgeTokens] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.sTok === 0
        ? ''
        : String(initialFromUrl.sTok)
      : ''
  );
  const [aimTokens, setAimTokens] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.aim === 0
        ? ''
        : String(initialFromUrl.aim)
      : ''
  );
  const [observeTokens, setObserveTokens] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.obs === 0
        ? ''
        : String(initialFromUrl.obs)
      : ''
  );
  const [preciseX, setPreciseX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.precise === 0
        ? ''
        : String(initialFromUrl.precise)
      : ''
  );
  const [ramX, setRamX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.ram === 0
        ? ''
        : String(initialFromUrl.ram)
      : ''
  );
  const [sharpshooterX, setSharpshooterX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.sharp === 0
        ? ''
        : String(initialFromUrl.sharp)
      : ''
  );
  const [pierceX, setPierceX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.pierce === 0
        ? ''
        : String(initialFromUrl.pierce)
      : ''
  );
  const [impactX, setImpactX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.impact === 0
        ? ''
        : String(initialFromUrl.impact)
      : ''
  );
  const [downgradeDefenseX, setDowngradeDefenseX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.downDef === 0
        ? ''
        : String(initialFromUrl.downDef)
      : ''
  );
  const [pointCost, setPointCost] = useState<string>(
    () => initialFromUrl?.cost ?? ''
  );
  const [defenseDieColor, setDefenseDieColor] = useState<DefenseDieColor>(
    () => initialFromUrl?.dColor ?? 'red'
  );
  const [defenseSurge, setDefenseSurge] = useState<DefenseSurgeConversion>(
    () => initialFromUrl?.dSurge ?? 'none'
  );
  const [defenseSurgeTokens, setDefenseSurgeTokens] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.dSurgeTok === 0
        ? ''
        : String(initialFromUrl.dSurgeTok)
      : ''
  );
  const [dodgeTokens, setDodgeTokens] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.dodge === 0
        ? ''
        : String(initialFromUrl.dodge)
      : ''
  );
  const [shieldTokens, setShieldTokens] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.shield === 0
        ? ''
        : String(initialFromUrl.shield)
      : ''
  );
  const [outmaneuver, setOutmaneuver] = useState<boolean>(
    () => initialFromUrl?.out ?? false
  );
  const [cover, setCover] = useState<CoverLevel>(
    () => initialFromUrl?.cover ?? 'none'
  );
  const [coverDieColor, setCoverDieColor] = useState<DefenseDieColor>(
    () => initialFromUrl?.cColor ?? 'white'
  );
  const [lowProfile, setLowProfile] = useState<boolean>(
    () => initialFromUrl?.lowProf ?? false
  );
  const [suppressed, setSuppressed] = useState<boolean>(
    () => initialFromUrl?.sup ?? false
  );
  const [coverX, setCoverX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.coverX === 0
        ? ''
        : String(initialFromUrl.coverX)
      : ''
  );
  const [armorX, setArmorX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.armor === 0
        ? ''
        : String(initialFromUrl.armor)
      : ''
  );
  const [impervious, setImpervious] = useState<boolean>(
    () => initialFromUrl?.imp ?? false
  );
  const [suppressionTokens, setSuppressionTokens] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.suppTok === 0
        ? ''
        : String(initialFromUrl.suppTok)
      : ''
  );
  const [dangerSenseX, setDangerSenseX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.danger === 0
        ? ''
        : String(initialFromUrl.danger)
      : ''
  );
  const [uncannyLuckX, setUncannyLuckX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.uLuck === 0
        ? ''
        : String(initialFromUrl.uLuck)
      : ''
  );
  const [upgradeDefenseX, setUpgradeDefenseX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.upDef === 0
        ? ''
        : String(initialFromUrl.upDef)
      : ''
  );
  const [backup, setBackup] = useState<boolean>(
    () => initialFromUrl?.backup ?? false
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [pinnedConfig, setPinnedConfig] = useState<PoolConfig | null>(() =>
    initialFromUrl?.cmp ? poolStateToConfig(initialFromUrl.a) : null
  );
  const [cachedPoolB, setCachedPoolB] = useState<PoolConfig | null>(() =>
    initialFromUrl?.cmp ? poolStateToConfig(initialFromUrl) : null
  );
  const [activePool, setActivePool] = useState<ActivePool>('B');
  const [labelA, setLabelA] = useState<string>(() => initialFromUrl?.la ?? 'A');
  const [labelB, setLabelB] = useState<string>(() => initialFromUrl?.lb ?? 'B');

  const simulationInputs = useMemo<PoolConfig>(
    () => ({
      pool,
      surge,
      criticalX,
      surgeTokens,
      aimTokens,
      observeTokens,
      preciseX,
      ramX,
      sharpshooterX,
      pierceX,
      impactX,
      downgradeDefenseX,
      pointCost,
      defenseDieColor,
      defenseSurge,
      defenseSurgeTokens,
      dodgeTokens,
      shieldTokens,
      outmaneuver,
      cover,
      coverDieColor,
      lowProfile,
      suppressed,
      coverX,
      armorX,
      impervious,
      suppressionTokens,
      dangerSenseX,
      uncannyLuckX,
      upgradeDefenseX,
      backup,
    }),
    [
      pool,
      surge,
      criticalX,
      surgeTokens,
      aimTokens,
      observeTokens,
      preciseX,
      ramX,
      sharpshooterX,
      pierceX,
      impactX,
      downgradeDefenseX,
      pointCost,
      defenseDieColor,
      defenseSurge,
      defenseSurgeTokens,
      dodgeTokens,
      shieldTokens,
      outmaneuver,
      cover,
      coverDieColor,
      lowProfile,
      suppressed,
      coverX,
      armorX,
      impervious,
      suppressionTokens,
      dangerSenseX,
      uncannyLuckX,
      upgradeDefenseX,
      backup,
    ]
  );

  const debouncedInputs = useDebouncedValue(simulationInputs);

  const editorConfig = useMemo(
    () => readConfigFromEditor(simulationInputs),
    [simulationInputs]
  );

  const liveConfig = useMemo<PoolConfig>(
    () => ({
      pool: debouncedInputs.pool,
      surge: debouncedInputs.surge,
      criticalX: debouncedInputs.criticalX,
      surgeTokens: debouncedInputs.surgeTokens,
      aimTokens: debouncedInputs.aimTokens,
      observeTokens: debouncedInputs.observeTokens,
      preciseX: debouncedInputs.preciseX,
      ramX: debouncedInputs.ramX,
      sharpshooterX: debouncedInputs.sharpshooterX,
      pierceX: debouncedInputs.pierceX,
      impactX: debouncedInputs.impactX,
      downgradeDefenseX: debouncedInputs.downgradeDefenseX,
      pointCost: debouncedInputs.pointCost,
      defenseDieColor: debouncedInputs.defenseDieColor,
      defenseSurge: debouncedInputs.defenseSurge,
      defenseSurgeTokens: debouncedInputs.defenseSurgeTokens,
      dodgeTokens: debouncedInputs.dodgeTokens,
      shieldTokens: debouncedInputs.shieldTokens,
      outmaneuver: debouncedInputs.outmaneuver,
      cover: debouncedInputs.cover,
      coverDieColor: debouncedInputs.coverDieColor,
      lowProfile: debouncedInputs.lowProfile,
      suppressed: debouncedInputs.suppressed,
      coverX: debouncedInputs.coverX,
      armorX: debouncedInputs.armorX,
      impervious: debouncedInputs.impervious,
      suppressionTokens: debouncedInputs.suppressionTokens,
      dangerSenseX: debouncedInputs.dangerSenseX,
      uncannyLuckX: debouncedInputs.uncannyLuckX,
      upgradeDefenseX: debouncedInputs.upgradeDefenseX,
      backup: debouncedInputs.backup,
    }),
    [debouncedInputs]
  );

  const isComparing = pinnedConfig !== null;

  const compareResolution = useMemo(
    () =>
      resolveCompareConfigs({
        pinnedConfig,
        cachedPoolB,
        activePool,
        editorConfig,
        debouncedEditorConfig: liveConfig,
      }),
    [pinnedConfig, cachedPoolB, activePool, editorConfig, liveConfig]
  );

  const configA = compareResolution?.configA ?? null;
  const configB = compareResolution?.configB ?? liveConfig;
  const debouncedConfigA = compareResolution?.debouncedConfigA ?? null;
  const debouncedConfigB = compareResolution?.debouncedConfigB ?? liveConfig;

  const urlState = useMemo<UrlState>(
    () =>
      buildAppUrlState({
        debouncedInputs,
        pinnedConfig,
        cachedPoolB,
        activePool,
        labelA,
        labelB,
      }),
    [debouncedInputs, pinnedConfig, cachedPoolB, activePool, labelA, labelB]
  );

  useEffect(() => {
    const fragment = buildFragment(urlState);
    const url =
      window.location.pathname +
      window.location.search +
      (fragment ? '#' + fragment : '');
    window.history.replaceState(undefined, '', url);
  }, [urlState]);

  const { results, woundsResults } = useMemo(
    () => computePoolResults(liveConfig),
    [liveConfig]
  );

  const compareResultsA = useMemo(
    () => (debouncedConfigA ? computePoolResults(debouncedConfigA) : null),
    [debouncedConfigA]
  );
  const compareResultsB = useMemo(
    () => (isComparing ? computePoolResults(debouncedConfigB) : null),
    [isComparing, debouncedConfigB]
  );
  const liveResults = useMemo(
    () => ({ results, woundsResults }),
    [results, woundsResults]
  );

  const poolEditorSetters: PoolEditorSetters = useMemo(
    () => ({
      setPool,
      setSurge,
      setCriticalX,
      setSurgeTokens,
      setAimTokens,
      setObserveTokens,
      setPreciseX,
      setRamX,
      setSharpshooterX,
      setPierceX,
      setImpactX,
      setDowngradeDefenseX,
      setPointCost,
      setDefenseDieColor,
      setDefenseSurge,
      setDefenseSurgeTokens,
      setDodgeTokens,
      setShieldTokens,
      setOutmaneuver,
      setCover,
      setCoverDieColor,
      setLowProfile,
      setSuppressed,
      setCoverX,
      setArmorX,
      setImpervious,
      setSuppressionTokens,
      setDangerSenseX,
      setUncannyLuckX,
      setUpgradeDefenseX,
      setBackup,
    }),
    []
  );

  const handleStartCompare = () => {
    const snapshot = readConfigFromEditor(simulationInputs);
    setPinnedConfig(snapshot);
    setCachedPoolB(snapshot);
    setActivePool('B');
  };

  const handleEndCompare = () => {
    setPinnedConfig(null);
    setCachedPoolB(null);
    setActivePool('B');
    handleReset();
  };

  const handleActivePoolChange = (pool: ActivePool) => {
    if (pool === activePool || !pinnedConfig) return;
    const outgoing = readConfigFromEditor(simulationInputs);
    let nextPinned = pinnedConfig;
    let nextCached = cachedPoolB;
    if (activePool === 'B') nextCached = outgoing;
    else nextPinned = outgoing;
    const incoming = pool === 'B' ? (nextCached ?? outgoing) : nextPinned;
    applyConfigToEditor(incoming, poolEditorSetters);
    setPinnedConfig(nextPinned);
    setCachedPoolB(nextCached);
    setActivePool(pool);
  };

  const totalDice = pool.red + pool.black + pool.white;
  const parsedCost = Number(pointCost);

  const handleReset = () => {
    setPool({ red: 0, black: 0, white: 0 });
    setSurge('none');
    setCriticalX('');
    setSurgeTokens('');
    setAimTokens('');
    setObserveTokens('');
    setPreciseX('');
    setRamX('');
    setSharpshooterX('');
    setPierceX('');
    setImpactX('');
    setDowngradeDefenseX('');
    setPointCost('');
    setDefenseDieColor('red');
    setDefenseSurge('none');
    setDefenseSurgeTokens('');
    setDodgeTokens('');
    setShieldTokens('');
    setOutmaneuver(false);
    setCover('none');
    setCoverDieColor('white');
    setLowProfile(false);
    setSuppressed(false);
    setCoverX('');
    setArmorX('');
    setImpervious(false);
    setSuppressionTokens('');
    setDangerSenseX('');
    setUncannyLuckX('');
    setUpgradeDefenseX('');
    setBackup(false);
    setPinnedConfig(null);
    setCachedPoolB(null);
    setActivePool('B');
    setLabelA('A');
    setLabelB('B');
  };

  const activePoolAccent = activePool === 'A' ? '#2563eb' : '#f59e0b';

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-title">
          <h1>
            <img src="/logo.svg" alt="" className="app__header-logo" />
            Legion Roller
          </h1>
          <p className="app__header-subtitle">Never tell me the odds!</p>
          <RulebookVersion />
        </div>
        <div className="app__header-actions">
          <button
            type="button"
            className="app__reset"
            onClick={() => setDiceRollerOpen(true)}
            title="Roll a dice pool to see its outcome"
          >
            Quick Roll
          </button>
          <button
            type="button"
            className="app__reset"
            onClick={() => setShareOpen(true)}
            title="Share this setup as a link, text, or image"
          >
            Share
          </button>
          <button type="button" className="app__reset" onClick={handleReset}>
            Reset
          </button>
        </div>
      </header>

      {diceRollerOpen ? (
        <DiceRollerModal onClose={() => setDiceRollerOpen(false)} />
      ) : null}

      {shareOpen ? (
        <ShareModal
          url={window.location.href}
          live={{
            config: configB,
            results: compareResultsB ?? liveResults,
            label: labelB || 'B',
          }}
          pinned={
            pinnedConfig && compareResultsA && configA
              ? {
                  config: configA,
                  results: compareResultsA,
                  label: labelA || 'A',
                }
              : undefined
          }
          onClose={() => setShareOpen(false)}
        />
      ) : null}

      <main className="app__main">
        <div className="app__layout">
          <section
            className={
              'app__pool' +
              (isComparing ? ' app__pool--compare' : '') +
              (isComparing
                ? ` app__pool--editing-${activePool.toLowerCase()}`
                : '')
            }
            style={
              isComparing ? { borderLeftColor: activePoolAccent } : undefined
            }
          >
            {isComparing ? (
              <ComparePoolBar
                mode="compare"
                labelA={labelA}
                labelB={labelB}
                activePool={activePool}
                onActivePoolChange={handleActivePoolChange}
                onEndCompare={handleEndCompare}
              />
            ) : (
              <ComparePoolBar
                mode="single"
                onStartCompare={handleStartCompare}
                startDisabled={totalDice === 0}
              />
            )}
            <div className="app__attack-pool">
              <h2 className="app__section-heading">Attack Pool</h2>
              <DiceSelector
                color="red"
                count={pool.red}
                onChange={(n) => setPool((p) => ({ ...p, red: n }))}
              />
              <DiceSelector
                color="black"
                count={pool.black}
                onChange={(n) => setPool((p) => ({ ...p, black: n }))}
              />
              <DiceSelector
                color="white"
                count={pool.white}
                onChange={(n) => setPool((p) => ({ ...p, white: n }))}
              />
              <AttackSurgeToggle value={surge} onChange={setSurge} />
              <h3 className="app__section-heading">Tokens</h3>
              <NumberInputWithControls
                id="surge-tokens"
                label="Surge"
                value={surgeTokens}
                onChange={setSurgeTokens}
                guideAnchor="surge-tokens"
              />
              <NumberInputWithControls
                id="aim-tokens"
                label="Aim"
                value={aimTokens}
                onChange={setAimTokens}
                title="Each Aim token: reroll up to 2 blanks"
                guideAnchor="aim"
              />
              <NumberInputWithControls
                id="observe-tokens"
                label="Observe"
                value={observeTokens}
                onChange={setObserveTokens}
                title="Each Observe token: reroll 1 blank."
                guideAnchor="observe-x"
              />
              <h3 className="app__section-heading">Keywords</h3>
              <NumberInputWithControls
                id="critical-x"
                label="Critical"
                value={criticalX}
                onChange={setCriticalX}
                title="Convert up to X surges to crits (before Surge Conversion)"
                guideAnchor="critical-x"
              />
              <NumberInputWithControls
                id="precise-x"
                label="Precise"
                value={preciseX}
                onChange={setPreciseX}
                title="Extra rerolls per Aim token when using Aim."
                guideAnchor="precise-x"
              />
              <NumberInputWithControls
                id="ram-x"
                label="Ram"
                value={ramX}
                onChange={setRamX}
                title="Convert up to X dice to crits after rerolls (blanks first, then hits)"
                guideAnchor="ram-x"
              />
              <NumberInputWithControls
                id="sharpshooter-x"
                label="Sharpshooter"
                value={sharpshooterX}
                onChange={setSharpshooterX}
                title="Reduce cover: 1 = heavy→light, light→none; 2 = heavy/light→none"
                guideAnchor="sharpshooter-x"
              />
              <NumberInputWithControls
                id="impact-x"
                label="Impact"
                value={impactX}
                onChange={setImpactX}
                min={0}
                title="Vs. a unit with Armor: convert up to X hit results to critical hit results before Armor cancels hit results (Armor affects hits only)."
                guideAnchor="impact-x"
              />
              <NumberInputWithControls
                id="pierce-x"
                label="Pierce"
                value={pierceX}
                onChange={setPierceX}
                min={0}
                title="Cancel up to X blocks on the final defense roll"
                guideAnchor="pierce-x"
              />
              <NumberInputWithControls
                id="downgrade-defense-dice-x"
                label="Downgrade Defense Dice X"
                value={downgradeDefenseX}
                onChange={setDowngradeDefenseX}
                min={0}
                title="Convert up to X red defense dice to white after gathering the defense pool (including Danger Sense extras). No effect if the defender rolls white. Does not affect cover. Uncanny Luck rerolls red dice first."
              />
              <div className="app__point-cost">
                <label htmlFor="point-cost">Unit Point Cost</label>
                <input
                  id="point-cost"
                  type="number"
                  min="0"
                  placeholder="Optional"
                  value={pointCost}
                  onChange={(e) => setPointCost(e.target.value)}
                />
              </div>
            </div>

            <div className="app__defense-pool">
              <h2 className="app__section-heading">Defense Pool</h2>
              <DefenseDiceToggle
                value={defenseDieColor}
                onChange={setDefenseDieColor}
              />
              <DefenseSurgeToggle
                value={defenseSurge}
                onChange={setDefenseSurge}
              />
              <CoverToggle value={cover} onChange={setCover} />
              <CoverDiceToggle
                value={coverDieColor}
                onChange={setCoverDieColor}
              />

              <h3 className="app__section-heading">Keywords</h3>
              <CheckboxToggle
                id="low-profile"
                label="Low Profile"
                title="When in cover, cancel one hit before rolling cover dice."
                checked={lowProfile}
                onChange={setLowProfile}
                guideAnchor="low-profile"
              />
              <CheckboxToggle
                id="backup"
                label="Backup"
                title="Backup is possible for Ranged 3+ shots and removes up to two hits when rolling defense dice."
                checked={backup}
                onChange={setBackup}
                guideAnchor="backup"
              />

              <CheckboxToggle
                id="outmaneuver"
                label="Outmaneuver"
                title="Dodge tokens can cancel crits as well as hits."
                checked={outmaneuver}
                onChange={setOutmaneuver}
                guideAnchor="outmaneuver"
              />
              <CheckboxToggle
                id="suppressed"
                label="Suppressed"
                title="Improve cover by 1 for cover rolls (none→light, light→heavy)."
                checked={suppressed}
                onChange={setSuppressed}
                disabled={cover === 'heavy'}
                guideAnchor="suppressed"
              />
              <CheckboxToggle
                id="impervious"
                label="Impervious"
                title="If you roll at least one block (after surge conversion), Pierce X cancels one fewer block."
                checked={impervious}
                onChange={setImpervious}
                guideAnchor="impervious"
              />
              <NumberInputWithControls
                id="cover-x"
                label="Cover"
                value={coverX}
                onChange={setCoverX}
                min={0}
                max={2}
                title="Improve cover by X for cover rolls (none=0, light=1, heavy=2); cannot exceed heavy."
                guideAnchor="cover-x"
              />
              <NumberInputWithControls
                id="armor-x"
                label="Armor"
                value={armorX}
                onChange={setArmorX}
                min={0}
                title="Cancel up to X hits after cover, before defense dice; crits are not reduced."
                guideAnchor="armor-x"
              />
              <NumberInputWithControls
                id="danger-sense-x"
                label="Danger Sense"
                value={dangerSenseX}
                onChange={setDangerSenseX}
                min={0}
                title="While defending, roll one extra defense die per suppression token, up to X extra dice."
                guideAnchor="danger-sense-x"
              />
              <NumberInputWithControls
                id="uncanny-luck-x"
                label="Uncanny Luck"
                value={uncannyLuckX}
                onChange={setUncannyLuckX}
                min={0}
                title="While defending, reroll up to X defense dice that would not become blocks."
                guideAnchor="uncanny-luck-x"
              />
              <NumberInputWithControls
                id="upgrade-defense-dice-x"
                label="Upgrade Defense Dice X"
                value={upgradeDefenseX}
                onChange={setUpgradeDefenseX}
                min={0}
                title="Convert up to X white defense dice to red after gathering the defense pool (including Danger Sense extras). No effect when there are no white dice. Does not affect cover. Uncanny Luck rerolls red dice first."
              />
              <h3 className="app__section-heading">Tokens</h3>
              <NumberInputWithControls
                id="defense-surge-tokens"
                label="Surge"
                value={defenseSurgeTokens}
                onChange={setDefenseSurgeTokens}
                min={0}
                guideAnchor="surge-tokens"
              />
              <NumberInputWithControls
                id="shield-tokens"
                label="Shield"
                value={shieldTokens}
                onChange={setShieldTokens}
                min={0}
                title="Cancel one hit or one crit per token before rolling defense (applied after cover, before dodge)."
                guideAnchor="shield-tokens"
              />
              <NumberInputWithControls
                id="dodge-tokens"
                label="Dodge"
                value={dodgeTokens}
                onChange={setDodgeTokens}
                title="Cancel one hit per token before rolling defense; crits cannot be dodged."
                guideAnchor="dodge"
              />
              <NumberInputWithControls
                id="suppression-tokens"
                label="Suppression"
                value={suppressionTokens}
                onChange={setSuppressionTokens}
                min={0}
                title="Number of suppression tokens on the defender; used by Danger Sense X for extra defense dice."
                guideAnchor="suppression"
              />
            </div>
          </section>

          <section className="app__results">
            {isComparing && compareResultsA && compareResultsB && configA ? (
              <>
                <ComparisonResults
                  configA={configA}
                  configB={configB}
                  resultsA={compareResultsA}
                  resultsB={compareResultsB}
                  costA={configA.pointCost}
                  costB={configB.pointCost}
                  labelA={labelA}
                  labelB={labelB}
                  onLabelAChange={setLabelA}
                  onLabelBChange={setLabelB}
                  activePool={activePool}
                  onSelectPoolA={() => handleActivePoolChange('A')}
                  onSelectPoolB={() => handleActivePoolChange('B')}
                />
              </>
            ) : totalDice === 0 ? (
              <p className="app__empty">Add dice to see results.</p>
            ) : (
              <>
                <h3 className="app__results-heading">Attack</h3>
                <StatsSummary
                  expectedHits={results.expectedHits}
                  expectedCrits={results.expectedCrits}
                  expectedTotal={results.expectedTotal}
                  pointCost={parsedCost > 0 ? parsedCost : undefined}
                />
                <DistributionChart
                  distribution={results.distribution}
                  title="Attack Distribution"
                  xAxisLabel="Total Successes"
                />
                <CumulativeCurve
                  cumulative={results.cumulative}
                  title="Attack: At Least N Successes"
                />
                <h3 className="app__results-heading">Wounds</h3>
                <div className="stats-summary">
                  <div className="stats-summary__stat stats-summary__stat--wounds">
                    <span className="stats-summary__value">
                      {woundsResults.expectedWounds.toFixed(2)}
                    </span>
                    <span className="stats-summary__label">Avg Wounds</span>
                  </div>
                  {parsedCost > 0 && woundsResults.expectedWounds > 0 && (
                    <div className="stats-summary__stat stats-summary__stat--efficiency">
                      <span className="stats-summary__value">
                        {(parsedCost / woundsResults.expectedWounds).toFixed(1)}
                      </span>
                      <span className="stats-summary__label">
                        Pts / Avg Wound
                      </span>
                    </div>
                  )}
                </div>
                <DistributionChart
                  distribution={woundsResults.distribution}
                  title="Wounds Distribution"
                  xAxisLabel="Wounds"
                  barColor="#dc2626"
                />
                <CumulativeCurve
                  cumulative={woundsResults.cumulative}
                  title="At Least N Wounds"
                />
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="app__footer">
        <div className="app__footer-bar">
          <a
            className="app__footer-kofi"
            href="https://ko-fi.com/E1E31V2I7V"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              height="36"
              style={{ border: '0px', height: '36px' }}
              src="https://storage.ko-fi.com/cdn/kofi3.png?v=6"
              alt="Support Legion Roller on Ko-fi"
            />
          </a>
          <p className="app__footer-links">
            Spotted a problem?{' '}
            <a
              href="https://github.com/dankraus/legion-roller/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open an issue on the Github page
            </a>{' '}
            and let me know.
          </p>
        </div>
        <p className="app__footer-tagline">
          Legion Roller is a dice simulator and probability calculator for Star
          Wars Legion by Atomic Mass Games. Results are calculated using Monte
          Carlo simulation with 10,000 runs to accurately model dice roll
          distributions.
        </p>
        <p className="app__footer-disclaimer">
          This site is not affiliated with, endorsed by, or connected with
          Atomic Mass Games or The Walt Disney Company. Star Wars Legion and
          related marks are trademarks of their respective owners.
        </p>
        <p className="app__footer-credit">
          Made in Massachusetts by{' '}
          <a
            href="http://www.dskraus.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dan Kraus
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
