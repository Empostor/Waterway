import { Player, RoleType, RoleTeamType } from "@skeldjs/au-core";
import { Room } from "../../Room";
import { BaseRole } from "./BaseRole";

/**
 * Noisemaker Role
 *
 * When this player completes a task, they emit a noise alert that reveals
 * their position to nearby players (and optionally to impostors).
 *
 * This is a Crewmate role.
 */
export class NoisemakerRole extends BaseRole {
    roleType = RoleType.Noisemaker;
    teamType = RoleTeamType.Crewmate;

    /** Duration of the alert in seconds. */
    get alertDuration(): number {
        return this.room.settings.roleSettings.noisemakerAlertDuration || 10;
    }

    /** Whether impostors also see the alert. */
    get impostorAlert(): boolean {
        return this.room.settings.roleSettings.noisemakerImpostorAlert !== false;
    }

    onGameStart(): void {
        this.isActive = true;
        this.room.logger.info("%s is the Noisemaker (alert duration: %ss, impostor alert: %s)",
            this.player, this.alertDuration, this.impostorAlert);
    }

    onTaskComplete(taskType: number, taskId: number): void {
        if (!this.isActive) return;

        this.room.logger.info("%s (Noisemaker) completed task %s, triggering alert!",
            this.player, taskId);

        // Broadcast the alert to nearby players
        this.triggerAlert();
    }

    /**
     * Trigger the noise alert, revealing this player's position.
     */
    private triggerAlert(): void {
        const characterControl = this.player.characterControl;
        if (!characterControl) return;

        // The alert is broadcast to players based on proximity
        // In the Among Us protocol, this is typically done by sending
        // a position snap/sync to relevant players

        // Determine who should see the alert
        const recipients: Player<Room>[] = [];

        for (const [, otherPlayer] of this.room.players) {
            if (otherPlayer.clientId === this.player.clientId) continue;

            const otherInfo = otherPlayer.getPlayerInfo();
            if (!otherInfo) continue;

            // Impostors can see if configured, crewmates always see
            if (otherInfo.isImpostor && !this.impostorAlert) continue;

            recipients.push(otherPlayer);
        }

        // Send a chat message to indicate the alert
        this.room.sendChat(
            `<color=orange>🔔 Noisemaker alert! ${this.player.username || "Someone"} revealed their position!</color>`
        );

        this.room.logger.debug("Noisemaker alert sent to %s players", recipients.length);

        // Start cooldown after alert
        this.startCooldown(this.alertDuration * 1000);
    }

    onDeath(): boolean {
        this.isActive = false;
        return true;
    }
}
