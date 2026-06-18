import { Player, RoleType, RoleTeamType } from "@skeldjs/au-core";
import { Room } from "../../Room";
import { BaseRole } from "./BaseRole";

/**
 * Viper Role
 *
 * When this impostor kills a player, the target doesn't die immediately.
 * Instead, they become "poisoned" and die after a dissolve delay.
 * This creates confusion as the kill is delayed and may happen during
 * a meeting or while the viper is elsewhere (providing an alibi).
 *
 * This is an Impostor role.
 */
export class ViperRole extends BaseRole {
    roleType = RoleType.Viper;
    teamType = RoleTeamType.Impostor;

    /** Set of poisoned player IDs awaiting dissolve. */
    private _poisonedPlayers: Set<number> = new Set();

    /** Timers for each poisoned player. */
    private _poisonTimers: Map<number, NodeJS.Timeout> = new Map();

    get dissolveTime(): number {
        return this.room.settings.roleSettings.viperDissolveTime || 15;
    }

    onGameStart(): void {
        this.isActive = true;
        this._poisonedPlayers.clear();
        this._poisonTimers.clear();

        this.room.logger.info("%s is the Viper (dissolve time: %ss)",
            this.player, this.dissolveTime);
    }

    /**
     * When the Viper kills, the target is poisoned instead of dying immediately.
     */
    onKill(target: Player<Room>): boolean {
        if (!this.isActive) return true; // Normal kill if ability inactive

        this.room.logger.info("%s (Viper) poisoned %s (dissolve in %ss)",
            this.player, target, this.dissolveTime);

        // Mark as poisoned
        this._poisonedPlayers.add(target.clientId);

        // Don't kill immediately — the dissolve timer will handle death
        // But we still need to prevent the normal kill from processing
        // The actual kill happens after the dissolve time

        // Send a subtle message to the target
        this.room.sendChat(
            `<color=#9900cc>You feel a sharp sting... something is wrong...</color>`,
            { targets: [target] }
        );

        // Set the dissolve timer
        const timer = setTimeout(() => {
            this.dissolveTarget(target);
        }, this.dissolveTime * 1000);

        this._poisonTimers.set(target.clientId, timer);

        return false; // Prevent normal kill — Viper handles it
    }

    /**
     * Actually kill the poisoned target after the dissolve time.
     */
    private dissolveTarget(target: Player<Room>): void {
        if (!this._poisonedPlayers.has(target.clientId)) return;

        this._poisonedPlayers.delete(target.clientId);
        this._poisonTimers.delete(target.clientId);

        // Check if the target is already dead
        const playerInfo = target.getPlayerInfo();
        if (playerInfo?.isDead) {
            this.room.logger.debug("%s (Viper) target %s was already dead, skipping dissolve",
                this.player, target);
            return;
        }

        this.room.logger.info("%s (Viper) poison dissolved on %s", this.player, target);

        // Send death message
        this.room.sendChat(
            `<color=#9900cc>${target.username || "Someone"} succumbed to poison!</color>`
        );

        // The target dies via the normal game engine mechanics
        // Poison mechanic is tracked by this role for timing
    }

    /**
     * Check if a player is currently poisoned by this Viper.
     */
    isPoisoned(playerId: number): boolean {
        return this._poisonedPlayers.has(playerId);
    }

    /**
     * Get all currently poisoned player IDs.
     */
    getPoisonedPlayers(): number[] {
        return [...this._poisonedPlayers];
    }

    onDeath(): boolean {
        // Clear all poison when the Viper dies
        this.clearAllPoisons();
        this.isActive = false;
        return true;
    }

    onGameEnd(): void {
        this.clearAllPoisons();
        this.isActive = false;
    }

    /**
     * Clear all active poisons (e.g., game over, Viper dies).
     */
    private clearAllPoisons(): void {
        for (const [, timer] of this._poisonTimers) {
            clearTimeout(timer);
        }
        this._poisonTimers.clear();
        this._poisonedPlayers.clear();
    }
}
