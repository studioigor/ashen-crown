import Phaser from 'phaser';
import { Race, Side } from '../config';

export interface PlayerState {
  side: Side;
  race: Race;
  gold: number;
  lumber: number;
  food: number;
  foodCap: number;
}

export class Economy {
  players: Record<number, PlayerState> = {};
  events = new Phaser.Events.EventEmitter();

  register(side: Side, race: Race, gold = 400, lumber = 200, cap = 5): void {
    this.players[side] = { side, race, gold, lumber, food: 0, foodCap: cap };
  }

  get(side: Side): PlayerState { return this.players[side]; }

  canAfford(side: Side, gold: number, lumber: number): boolean {
    const p = this.players[side];
    return p.gold >= gold && p.lumber >= lumber;
  }

  spend(side: Side, gold: number, lumber: number): boolean {
    const p = this.players[side];
    if (p.gold < gold || p.lumber < lumber) return false;
    p.gold -= gold; p.lumber -= lumber;
    this.events.emit('changed', side);
    return true;
  }

  deposit(side: Side, type: 'gold' | 'lumber', amount: number): void {
    const p = this.players[side];
    if (type === 'gold') p.gold += amount; else p.lumber += amount;
    this.events.emit('changed', side);
  }

  addCap(side: Side, n: number): void {
    this.players[side].foodCap = Math.min(100, this.players[side].foodCap + n);
    this.events.emit('changed', side);
  }
  removeCap(side: Side, n: number): void {
    this.players[side].foodCap = Math.max(0, this.players[side].foodCap - n);
    this.events.emit('changed', side);
  }
  addFood(side: Side, n: number): void {
    this.players[side].food += n;
    this.events.emit('changed', side);
  }
  removeFood(side: Side, n: number): void {
    this.players[side].food = Math.max(0, this.players[side].food - n);
    this.events.emit('changed', side);
  }
  hasFoodRoom(side: Side, need: number): boolean {
    const p = this.players[side];
    return p.food + need <= p.foodCap;
  }
}
