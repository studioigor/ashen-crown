import Phaser from 'phaser';
import { Race, Difficulty, STORY_MODE_DEFAULTS, type GameLaunchConfig } from '../config';
import videoUrl from '../menu/video-background.mp4?url';
import { ART_RUNTIME_MANIFEST_KEY, artAssetUrl, type RuntimeArtManifest } from '../assets/artManifest';
import type { GameInit } from './GameScene';

type DebugScenario = 'pathfinding' | 'perf-100' | 'perf-300' | 'perf-500' | 'caravans' | 'skirmish';

export class MenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'normal';
  private menuEl: HTMLElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private debugPanelEl: HTMLElement | null = null;
  private debugScenario: DebugScenario = 'skirmish';
  private debugRace: Race = 'alliance';
  private debugDifficulty: Difficulty = 'normal';
  private raceHandler = (e: Event): void => {
    const btn = (e.currentTarget as HTMLElement);
    const race = btn.dataset.race as Race;
    this.startSkirmish(race);
  };
  private diffHandler = (e: Event): void => {
    const btn = (e.currentTarget as HTMLElement);
    this.selectedDifficulty = btn.dataset.diff as Difficulty;
    this.refreshDifficulty();
  };
  private storyHandler = (): void => this.startStory();
  private debugToggleHandler = (): void => this.openDebugPanel();
  private debugCloseHandler = (): void => this.closeDebugPanel();
  private debugScenarioHandler = (e: Event): void => {
    const btn = e.currentTarget as HTMLElement;
    this.debugScenario = btn.dataset.scn as DebugScenario;
    this.refreshDebugSelection();
  };
  private debugRaceHandler = (e: Event): void => {
    const btn = e.currentTarget as HTMLElement;
    this.debugRace = btn.dataset.race as Race;
    this.refreshDebugSelection();
  };
  private debugDiffHandler = (e: Event): void => {
    const btn = e.currentTarget as HTMLElement;
    this.debugDifficulty = btn.dataset.diff as Difficulty;
    this.refreshDebugSelection();
  };
  private debugStartHandler = (): void => this.startDebugScenario();
  private debugBackdropHandler = (e: Event): void => {
    if (e.target === this.debugPanelEl) this.closeDebugPanel();
  };

  constructor() { super('MenuScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    if (this.isDebugPathfindingEnabled()) {
      this.start({
        mode: 'skirmish',
        playerRace: 'alliance',
        difficulty: 'normal'
      });
      return;
    }

    this.menuEl = document.getElementById('menu-layer');
    this.videoEl = document.getElementById('menu-video') as HTMLVideoElement | null;

    if (this.videoEl) {
      if (!this.videoEl.src) this.videoEl.src = videoUrl;
      this.videoEl.muted = true;
      this.videoEl.loop = true;
      this.videoEl.playsInline = true;
      this.videoEl.classList.add('visible');
      void this.videoEl.play().catch(() => { /* autoplay blocked — ignored */ });
    }

    if (this.menuEl) {
      this.applyArtBackground();
      this.menuEl.style.display = 'flex';
      requestAnimationFrame(() => this.menuEl?.classList.add('visible'));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-race').forEach(b => b.addEventListener('click', this.raceHandler));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-diff').forEach(b => b.addEventListener('click', this.diffHandler));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-story').forEach(b => b.addEventListener('click', this.storyHandler));
      this.refreshDifficulty();
      this.setupDebugPanel();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  private refreshDifficulty(): void {
    if (!this.menuEl) return;
    this.menuEl.querySelectorAll<HTMLElement>('.menu-diff').forEach(b => {
      b.classList.toggle('active', b.dataset.diff === this.selectedDifficulty);
    });
  }

  private teardown(): void {
    if (this.menuEl) {
      this.menuEl.classList.remove('visible');
      this.menuEl.classList.remove('has-art-bg');
      this.menuEl.style.removeProperty('--menu-bg-art');
      this.menuEl.style.display = 'none';
      this.menuEl.querySelectorAll<HTMLElement>('.menu-race').forEach(b => b.removeEventListener('click', this.raceHandler));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-diff').forEach(b => b.removeEventListener('click', this.diffHandler));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-story').forEach(b => b.removeEventListener('click', this.storyHandler));
    }
    if (this.videoEl) {
      this.videoEl.classList.remove('visible');
      this.videoEl.pause();
    }
    this.teardownDebugPanel();
  }

  private startSkirmish(race: Race): void {
    this.start({
      mode: 'skirmish',
      playerRace: race,
      difficulty: this.selectedDifficulty
    });
  }

  private startStory(): void {
    this.start({ ...STORY_MODE_DEFAULTS });
  }

  private start(config: GameLaunchConfig): void {
    const seed = this.seedFromQuery();
    this.scene.start('GameScene', seed === undefined ? config : { ...config, seed });
  }

  private isDebugPathfindingEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debugPathfinding') === '1';
  }

  private seedFromQuery(): number | undefined {
    if (typeof window === 'undefined') return undefined;
    const raw = new URLSearchParams(window.location.search).get('seed');
    if (!raw) return undefined;
    const seed = Number(raw);
    return Number.isFinite(seed) ? Math.floor(seed) : undefined;
  }

  private applyArtBackground(): void {
    if (!this.menuEl) return;
    const runtime = this.cache.json.get(ART_RUNTIME_MANIFEST_KEY) as RuntimeArtManifest | undefined;
    const enabled = runtime?.loadAll || runtime?.enabledKeys?.includes('menu_background_map');
    if (!enabled) return;
    this.menuEl.style.setProperty('--menu-bg-art', `url("${artAssetUrl('assets/art/menu/background_map.png')}")`);
    this.menuEl.classList.add('has-art-bg');
    if (this.videoEl) this.videoEl.classList.remove('visible');
  }

  private setupDebugPanel(): void {
    const toggle = document.getElementById('menu-debug-toggle');
    const panel = document.getElementById('menu-debug-panel');
    const closeBtn = document.getElementById('menu-debug-close');
    const cancelBtn = document.getElementById('menu-debug-cancel');
    const startBtn = document.getElementById('menu-debug-start');
    if (!toggle || !panel || !closeBtn || !cancelBtn || !startBtn) return;
    this.debugPanelEl = panel;

    toggle.addEventListener('click', this.debugToggleHandler);
    closeBtn.addEventListener('click', this.debugCloseHandler);
    cancelBtn.addEventListener('click', this.debugCloseHandler);
    startBtn.addEventListener('click', this.debugStartHandler);
    panel.addEventListener('click', this.debugBackdropHandler);

    panel.querySelectorAll<HTMLElement>('#menu-debug-scenarios button').forEach(b => b.addEventListener('click', this.debugScenarioHandler));
    panel.querySelectorAll<HTMLElement>('#menu-debug-races button').forEach(b => b.addEventListener('click', this.debugRaceHandler));
    panel.querySelectorAll<HTMLElement>('#menu-debug-diffs button').forEach(b => b.addEventListener('click', this.debugDiffHandler));

    this.refreshDebugSelection();
  }

  private teardownDebugPanel(): void {
    const toggle = document.getElementById('menu-debug-toggle');
    const panel = this.debugPanelEl;
    const closeBtn = document.getElementById('menu-debug-close');
    const cancelBtn = document.getElementById('menu-debug-cancel');
    const startBtn = document.getElementById('menu-debug-start');
    toggle?.removeEventListener('click', this.debugToggleHandler);
    closeBtn?.removeEventListener('click', this.debugCloseHandler);
    cancelBtn?.removeEventListener('click', this.debugCloseHandler);
    startBtn?.removeEventListener('click', this.debugStartHandler);
    panel?.removeEventListener('click', this.debugBackdropHandler);
    panel?.querySelectorAll<HTMLElement>('#menu-debug-scenarios button').forEach(b => b.removeEventListener('click', this.debugScenarioHandler));
    panel?.querySelectorAll<HTMLElement>('#menu-debug-races button').forEach(b => b.removeEventListener('click', this.debugRaceHandler));
    panel?.querySelectorAll<HTMLElement>('#menu-debug-diffs button').forEach(b => b.removeEventListener('click', this.debugDiffHandler));
    if (panel) {
      panel.classList.remove('visible');
      panel.setAttribute('aria-hidden', 'true');
    }
    this.debugPanelEl = null;
  }

  private openDebugPanel(): void {
    if (!this.debugPanelEl) return;
    this.debugPanelEl.classList.add('visible');
    this.debugPanelEl.setAttribute('aria-hidden', 'false');
  }

  private closeDebugPanel(): void {
    if (!this.debugPanelEl) return;
    this.debugPanelEl.classList.remove('visible');
    this.debugPanelEl.setAttribute('aria-hidden', 'true');
  }

  private refreshDebugSelection(): void {
    if (!this.debugPanelEl) return;
    this.debugPanelEl.querySelectorAll<HTMLElement>('#menu-debug-scenarios button').forEach(b => {
      b.classList.toggle('active', b.dataset.scn === this.debugScenario);
    });
    this.debugPanelEl.querySelectorAll<HTMLElement>('#menu-debug-races button').forEach(b => {
      b.classList.toggle('active', b.dataset.race === this.debugRace);
    });
    this.debugPanelEl.querySelectorAll<HTMLElement>('#menu-debug-diffs button').forEach(b => {
      b.classList.toggle('active', b.dataset.diff === this.debugDifficulty);
    });
  }

  private startDebugScenario(): void {
    const seedInput = document.getElementById('menu-debug-seed') as HTMLInputElement | null;
    const seedRaw = seedInput?.value.trim();
    const seed = seedRaw ? Number(seedRaw) : NaN;
    const overrideSeed = Number.isFinite(seed) ? Math.floor(seed) : undefined;

    const baseConfig: GameLaunchConfig = {
      mode: 'skirmish',
      playerRace: this.debugRace,
      difficulty: this.debugDifficulty
    };

    const init: GameInit = { ...baseConfig };
    switch (this.debugScenario) {
      case 'pathfinding':
        init.debugPathfinding = true;
        break;
      case 'perf-100':
        init.debugPerf = true;
        init.debugPerfSize = 100;
        break;
      case 'perf-300':
        init.debugPerf = true;
        init.debugPerfSize = 300;
        break;
      case 'perf-500':
        init.debugPerf = true;
        init.debugPerfSize = 500;
        break;
      case 'caravans':
        init.debugCaravans = true;
        break;
      case 'skirmish':
      default:
        break;
    }

    if (overrideSeed !== undefined) init.seed = overrideSeed;
    this.closeDebugPanel();
    this.scene.start('GameScene', init);
  }
}
