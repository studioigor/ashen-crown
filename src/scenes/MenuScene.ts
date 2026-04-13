import Phaser from 'phaser';
import { Race, Difficulty } from '../config';
import videoUrl from '../menu/video-background.mp4?url';

export class MenuScene extends Phaser.Scene {
  private selectedDifficulty: Difficulty = 'normal';
  private menuEl: HTMLElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private raceHandler = (e: Event): void => {
    const btn = (e.currentTarget as HTMLElement);
    const race = btn.dataset.race as Race;
    this.start(race);
  };
  private diffHandler = (e: Event): void => {
    const btn = (e.currentTarget as HTMLElement);
    this.selectedDifficulty = btn.dataset.diff as Difficulty;
    this.refreshDifficulty();
  };

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
      this.menuEl.style.display = 'flex';
      requestAnimationFrame(() => this.menuEl?.classList.add('visible'));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-race').forEach(b => b.addEventListener('click', this.raceHandler));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-diff').forEach(b => b.addEventListener('click', this.diffHandler));
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
      this.menuEl.style.display = 'none';
      this.menuEl.querySelectorAll<HTMLElement>('.menu-race').forEach(b => b.removeEventListener('click', this.raceHandler));
      this.menuEl.querySelectorAll<HTMLElement>('.menu-diff').forEach(b => b.removeEventListener('click', this.diffHandler));
    }
    if (this.videoEl) {
      this.videoEl.classList.remove('visible');
      this.videoEl.pause();
    }
  }

  private start(race: Race): void {
    this.scene.start('GameScene', { playerRace: race, difficulty: this.selectedDifficulty });
  }
}
