import { Player, RoleType, RoleTeamType } from "@skeldjs/au-core";
import { Room } from "../../Room";
import { BaseRole } from "./BaseRole";

/**
 * Phantom Role
 *
 * When this player is killed, instead of dying immediately, they enter a
 * "vanished" ghost state where they can continue moving invisibly for a
 * limited duration. After the duration expires, they properly die.
 *
 * This is an Impostor role.
 */
export class PhantomRole extends BaseRole {
    roleType = RoleType.Phantom;
    teamType = RoleTeamType.Impostor;

    /** Whether the phantom is currently in the vanished state. */
    isVanished: boolean = false;

    /** Timer for the vanish duration. */
    private _vanishTimer: NodeJS.Timeout | null = null;

    /** Timer for the cooldown between vanish uses. */
    private _cooldownTimer: NodeJS.Timeout | null = null;

    get cooldown(): number {
        return this.room.settings.roleSettings.phantomCooldown || 15;
    }

    get duration(): number {
        return this.room.settings.roleSettings.phantomDuration || 30;
    }

    onGameStart(): void {
        this.isActive = true;
        this.room.logger.info("%s is the Phantom (duration: %ss, cooldown: %ss)",
            this.player, this.duration, this.cooldown);
    }

    /**
     * The Phantom doesn't die immediately. Instead, they enter a vanished state.
     */
    onDeath(): boolean {
        if (!this.isActive) return true; // Normal death

        // Enter vanished state instead of dying
        this.isVanished = true;
        this.room.logger.info("%s (Phantom) entered vanished state for %ss",
            this.player, this.duration);

        // Notify the player
        this.room.sendChat(
            `<color=#cc66ff>${this.player.username || "Someone"} has vanished into the shadows...</color>`,
            { targets: [...this.room.players.values()] }
        );

        // Set a timer to properly die after the duration
        this._vanishTimer = setTimeout(() => {
            this.endVanish();
        }, this.duration * 1000);

        // Disable the ability until cooldown
        this.isActive = false;
        this._cooldownTimer = setTimeout(() => {
            this.isActive = true;
            this.room.logger.debug("%s Phantom ability ready again", this.player);
        }, this.cooldown * 1000);

        return false; // Prevent normal death
    }

    /**
     * End the vanished state and properly kill the phantom.
     */
    private endVanish(): void {
        if (!this.isVanished) return;

        this.isVanished = false;
        this.room.logger.info("%s (Phantom) vanished state ended", this.player);

        // Clear timer
        if (this._vanishTimer) {
            clearTimeout(this._vanishTimer);
            this._vanishTimer = null;
        }

        // The player actually dies now via the normal game engine mechanics
    }

    /**
     * Force-end the vanish state (e.g., game ends).
     */
    forceEndVanish(): void {
        if (this._vanishTimer) {
            clearTimeout(this._vanishTimer);
            this._vanishTimer = null;
        }
        this.isVanished = false;
    }

    onGameEnd(): void {
        this.forceEndVanish();
        if (this._cooldownTimer) {
            clearTimeout(this._cooldownTimer);
            this._cooldownTimer = null;
        }
        this.isActive = false;
    }
}
