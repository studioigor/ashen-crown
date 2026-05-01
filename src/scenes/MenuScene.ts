import Phaser from 'phaser';
import { Race, Difficulty, STORY_MODE_DEFAULTS, type GameLaunchConfig } from '../config';
import videoUrl from '../menu/video-background.mp4?url';
import { ART_RUNTIME_MANIFEST_KEY, artAssetUrl, type RuntimeArtManifest } from '../assets/artManifest';

export class MenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'normal';
  private menuEl: HTMLElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
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

  constructor() { super('MenuScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

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
    this.scene.start('GameScene', config);
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
}
