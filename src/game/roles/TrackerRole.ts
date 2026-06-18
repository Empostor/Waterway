import { Player, RoleType, RoleTeamType } from "@skeldjs/au-core";
import { Room } from "../../Room";
import { BaseRole } from "./BaseRole";

/**
 * Tracker Role
 *
 * Can mark a target player and receive periodic position updates
 * (arrow indicators pointing to the target's direction).
 *
 * This is a Crewmate role.
 */
export class TrackerRole extends BaseRole {
    roleType = RoleType.Tracker;
    teamType = RoleTeamType.Crewmate;

    /** The currently tracked player, if any. */
    trackedTarget: Player<Room> | null = null;

    /** Timer for periodic position updates. */
    private _trackingTimer: NodeJS.Timeout | null = null;

    /** How long the tracking has been active. */
    private _trackingElapsed: number = 0;

    get cooldown(): number {
        return this.room.settings.roleSettings.trackerCooldown || 15;
    }

    get duration(): number {
        return this.room.settings.roleSettings.trackerDuration || 30;
    }

    get delay(): number {
        return this.room.settings.roleSettings.trackerDelay || 1;
    }

    onGameStart(): void {
        this.isActive = true;
        this.room.logger.info("%s is the Tracker (duration: %ss, cooldown: %ss, delay: %ss)",
            this.player, this.duration, this.cooldown, this.delay);
    }

    /**
     * Use the tracking ability on a target player.
     */
    onAbilityUse(target?: Player<Room>): boolean {
        if (!target) {
            this.room.logger.warn("%s (Tracker) attempted to track but no target specified", this.player);
            return false;
        }

        if (!this.canUseAbility()) {
            this.room.logger.warn("%s (Tracker) ability on cooldown", this.player);
            return false;
        }

        if (target.clientId === this.player.clientId) {
            this.room.logger.warn("%s (Tracker) attempted to track themselves", this.player);
            return false;
        }

        // Start tracking
        this.trackedTarget = target;
        this._trackingElapsed = 0;
        this.startCooldown(this.cooldown * 1000);

        this.room.logger.info("%s (Tracker) is now tracking %s", this.player, target);

        this.room.sendChat(
            `<color=#00ccff>Tracker is on the hunt...</color>`,
            { targets: [this.player] }
        );

        // Start periodic position updates
        this._trackingTimer = setInterval(() => {
            this.sendPositionUpdate();
            this._trackingElapsed += this.delay;

            // Stop tracking after duration expires
            if (this._trackingElapsed >= this.duration) {
                this.stopTracking();
            }
        }, this.delay * 1000);

        return true;
    }

    /**
     * Send a position update about the tracked target to this player.
     */
    private sendPositionUpdate(): void {
        if (!this.trackedTarget || !this.trackedTarget.characterControl) {
            this.stopTracking();
            return;
        }

        // In the actual game, this would send an arrow/indicator RPC
        // For now, we log the position update
        this.room.logger.debug("%s (Tracker) received position update for %s",
            this.player, this.trackedTarget);
    }

    /**
     * Stop tracking the current target.
     */
    private stopTracking(): void {
        if (this._trackingTimer) {
            clearInterval(this._trackingTimer);
            this._trackingTimer = null;
        }

        if (this.trackedTarget) {
            this.room.logger.info("%s (Tracker) stopped tracking %s",
                this.player, this.trackedTarget);
        }

        this.trackedTarget = null;
        this._trackingElapsed = 0;
    }

    onDeath(): boolean {
        this.stopTracking();
        this.isActive = false;
        return true;
    }

    onGameEnd(): void {
        this.stopTracking();
        this.isActive = false;
    }
}
