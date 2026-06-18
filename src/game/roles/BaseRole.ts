import { Player, RoleType, RoleTeamType } from "@skeldjs/au-core";
import { Room } from "../../Room";

/**
 * Base class for all role implementations in Waterway.
 *
 * Each role overrides specific hooks to implement its unique behavior.
 * Roles are assigned to players when a game starts based on role settings.
 */
export abstract class BaseRole {
    /** The unique role type identifier from the Among Us protocol. */
    abstract roleType: RoleType;

    /** Which team this role belongs to (Crewmate or Impostor). */
    abstract teamType: RoleTeamType;

    /** Whether this role's ability is currently active. */
    isActive: boolean = false;

    /** The current cooldown timer for the role's ability (in milliseconds). */
    currentCooldown: number = 0;

    /** When the ability was last used (Unix timestamp in ms). */
    lastAbilityUse: number = 0;

    /** Whether this role's ability is on cooldown. */
    get isOnCooldown(): boolean {
        return this.currentCooldown > 0 && (Date.now() - this.lastAbilityUse) < this.currentCooldown;
    }

    constructor(
        /** The room this role exists in. */
        public readonly room: Room,
        /** The player who has this role. */
        public readonly player: Player<Room>,
    ) {}

    /**
     * Called once when the role is assigned and the game starts.
     * Use this to initialize role state, set up timers, etc.
     */
    onGameStart(): void {}

    /**
     * Called when the player with this role kills another player.
     * Override in imposter roles.
     *
     * @param target The player being killed.
     * @returns Whether the kill should proceed normally (true) or be handled by the role (false).
     */
    onKill(target: Player<Room>): boolean {
        return true; // Allow normal kill behavior
    }

    /**
     * Called when the player completes a task.
     *
     * @param taskType The type of task completed.
     * @param taskId The unique task ID.
     */
    onTaskComplete(taskType: number, taskId: number): void {}

    /**
     * Called when a meeting starts.
     */
    onMeetingStart(): void {}

    /**
     * Called when the player dies.
     * Return false to prevent the normal death behavior (e.g., Phantom).
     */
    onDeath(): boolean {
        return true; // Allow normal death behavior
    }

    /**
     * Called when the player uses their role ability.
     * Subclasses override this to implement the ability.
     *
     * @param target Optional target player for targeted abilities.
     * @returns Whether the ability was successfully used.
     */
    onAbilityUse(target?: Player<Room>): boolean {
        return false;
    }

    /**
     * Called every fixed update tick while the game is running.
     * Use for cooldown management, periodic effects, etc.
     */
    onFixedUpdate(): void {}

    /**
     * Called when the game ends.
     */
    onGameEnd(): void {}

    /**
     * Start the cooldown for this role's ability.
     * @param cooldownMs Cooldown duration in milliseconds.
     */
    protected startCooldown(cooldownMs: number): void {
        this.currentCooldown = cooldownMs;
        this.lastAbilityUse = Date.now();
    }

    /**
     * Check if the ability can be used (not on cooldown and role is active).
     */
    canUseAbility(): boolean {
        return this.isActive && !this.isOnCooldown;
    }

    /**
     * Get a human-readable name for this role type.
     */
    getRoleName(): string {
        return RoleType[this.roleType] || "Unknown";
    }
}
