import { Player, RoleType, RoleTeamType } from "@skeldjs/au-core";
import { Room } from "../../Room";
import { BaseRole } from "./BaseRole";
import { NoisemakerRole } from "./NoisemakerRole";
import { PhantomRole } from "./PhantomRole";
import { TrackerRole } from "./TrackerRole";
import { DetectiveRole } from "./DetectiveRole";
import { ViperRole } from "./ViperRole";
import { ScientistRole } from "./ScientistRole";
import { EngineerRole } from "./EngineerRole";
import { GuardianAngelRole } from "./GuardianAngelRole";
import { ShapeshifterRole } from "./ShapeshifterRole";

/**
 * Maps role types to their implementing classes.
 */
const ROLE_CONSTRUCTORS: Partial<Record<RoleType, new (room: Room, player: Player<Room>) => BaseRole>> = {
    [RoleType.Scientist]: ScientistRole,
    [RoleType.Engineer]: EngineerRole,
    [RoleType.GuardianAngel]: GuardianAngelRole,
    [RoleType.Shapeshifter]: ShapeshifterRole,
    [RoleType.Noisemaker]: NoisemakerRole,
    [RoleType.Phantom]: PhantomRole,
    [RoleType.Tracker]: TrackerRole,
    [RoleType.Detective]: DetectiveRole,
    [RoleType.Viper]: ViperRole,
};

/**
 * Manages role assignment and lifecycle for a room.
 *
 * When a game starts, the RoleManager reads the room's role settings
 * and assigns roles to players based on the configured chances and
 * maximum player counts.
 */
export class RoleManager {
    /** All active role instances, keyed by player client ID. */
    activeRoles: Map<number, BaseRole> = new Map();

    constructor(public readonly room: Room) {}

    /**
     * Assign roles to players based on the room's role settings.
     * Called when the game starts.
     */
    assignRoles(): void {
        const settings = this.room.settings;
        const roleChances = settings.roleSettings.roleChances;

        if (!roleChances) return;

        const availablePlayers = [...this.room.players.values()].filter(
            p => p.characterControl && p.inScene
        );

        // Track how many of each role we've assigned
        const assignedCounts: Partial<Record<RoleType, number>> = {};

        for (const [roleTypeStr, roleChance] of Object.entries(roleChances)) {
            const roleType = parseInt(roleTypeStr) as RoleType;

            // Skip if no chance or no constructor for this role
            if (roleChance.chance <= 0) continue;
            if (!ROLE_CONSTRUCTORS[roleType]) continue;

            const RoleCtor = ROLE_CONSTRUCTORS[roleType]!;
            assignedCounts[roleType] = 0;

            for (const player of availablePlayers) {
                // Check max players limit for this role
                if (assignedCounts[roleType]! >= roleChance.maxPlayers) break;

                // Skip players that already have a role
                if (this.activeRoles.has(player.clientId)) continue;

                // Skip players who are already the standard impostor (for crewmate roles)
                const playerInfo = player.getPlayerInfo();
                const isImpostor = playerInfo?.isImpostor || false;
                const isCrewmateRole = [
                    RoleType.Crewmate,
                    RoleType.Scientist,
                    RoleType.Engineer,
                    RoleType.GuardianAngel,
                    RoleType.Noisemaker,
                    RoleType.Tracker,
                    RoleType.Detective,
                ].includes(roleType);

                const isImpostorRole = [
                    RoleType.Impostor,
                    RoleType.Shapeshifter,
                    RoleType.Phantom,
                    RoleType.Viper,
                ].includes(roleType);

                // Crewmate roles should not be assigned to impostors
                if (isCrewmateRole && isImpostor) continue;
                // Impostor roles should not be assigned to crewmates
                if (isImpostorRole && !isImpostor) continue;

                // Roll the dice
                const roll = Math.random() * 100;
                if (roll <= roleChance.chance) {
                    this.assignRoleToPlayer(player, RoleCtor, roleType);
                    assignedCounts[roleType]!++;
                }
            }
        }

        // Log assignment summary
        const assignedCount = this.activeRoles.size;
        if (assignedCount > 0) {
            this.room.logger.info("Assigned %s role(s) to players", assignedCount);
            for (const [playerId, role] of this.activeRoles) {
                const player = this.room.players.get(playerId);
                this.room.logger.info("  %s → %s", player, role.getRoleName());
            }
        }
    }

    /**
     * Create and assign a role to a specific player.
     */
    assignRoleToPlayer(
        player: Player<Room>,
        RoleCtor: new (room: Room, player: Player<Room>) => BaseRole,
        roleType: RoleType
    ): BaseRole {
        const role = new RoleCtor(this.room, player);
        this.activeRoles.set(player.clientId, role);

        // The player's role is tracked by this manager
        // The client-facing role is set via PlayerControl.setRole RPC
        if (player.characterControl) {
            (player.characterControl as any).setRole(roleType);
        }

        // Initialize the role
        role.onGameStart();

        return role;
    }

    /**
     * Get the role instance for a player, if any.
     */
    getRoleForPlayer(player: Player<Room>): BaseRole | null {
        return this.activeRoles.get(player.clientId) || null;
    }

    /**
     * Check if a player has a specific role type.
     */
    playerHasRole(player: Player<Room>, roleType: RoleType): boolean {
        const role = this.activeRoles.get(player.clientId);
        return role?.roleType === roleType;
    }

    /**
     * Called when a player with a role kills someone.
     * Routes to the appropriate role's onKill handler.
     */
    handleKill(killer: Player<Room>, target: Player<Room>): boolean {
        const role = this.activeRoles.get(killer.clientId);
        if (!role) return true; // No special role, allow normal kill

        return role.onKill(target);
    }

    /**
     * Called when a player with a role completes a task.
     * Routes to the appropriate role's onTaskComplete handler.
     */
    handleTaskComplete(player: Player<Room>, taskType: number, taskId: number): void {
        const role = this.activeRoles.get(player.clientId);
        if (!role) return;

        role.onTaskComplete(taskType, taskId);
    }

    /**
     * Called when a player with a role dies.
     * Routes to the appropriate role's onDeath handler.
     */
    handleDeath(player: Player<Room>): boolean {
        const role = this.activeRoles.get(player.clientId);
        if (!role) return true; // No special role, allow normal death

        const result = role.onDeath();

        // If the role allowed normal death, clean up
        if (result) {
            this.activeRoles.delete(player.clientId);
        }

        return result;
    }

    /**
     * Called when a meeting starts.
     */
    handleMeetingStart(): void {
        for (const [, role] of this.activeRoles) {
            role.onMeetingStart();
        }
    }

    /**
     * Called every fixed update tick.
     */
    handleFixedUpdate(): void {
        for (const [, role] of this.activeRoles) {
            role.onFixedUpdate();
        }
    }

    /**
     * Called when the game ends.
     * Cleans up all active roles.
     */
    handleGameEnd(): void {
        for (const [, role] of this.activeRoles) {
            role.onGameEnd();
        }
        this.activeRoles.clear();
    }

    /**
     * Called when a player uses their role ability.
     */
    handleAbilityUse(player: Player<Room>, target?: Player<Room>): boolean {
        const role = this.activeRoles.get(player.clientId);
        if (!role) return false;

        return role.onAbilityUse(target);
    }

    /**
     * Get all active role instances.
     */
    getAllRoles(): BaseRole[] {
        return [...this.activeRoles.values()];
    }

    /**
     * Register a custom role constructor.
     * Allows plugins to add new roles.
     */
    static registerRole(roleType: RoleType, ctor: new (room: Room, player: Player<Room>) => BaseRole): void {
        ROLE_CONSTRUCTORS[roleType] = ctor;
    }
}
