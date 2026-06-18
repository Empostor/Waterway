import { BasicEvent } from "@skeldjs/events";
import { Player } from "@skeldjs/au-core";

import { Room } from "../../../Room";

/**
 * Emitted when an impostor's murder attempt fails.
 *
 * Reasons for failure include:
 * - "protected": The target was protected by a Guardian Angel.
 * - "already_dead": The target was already killed.
 * - "invulnerable": The target is in an invulnerable state.
 * - "in_vent": The target is in a vent.
 * - "cooldown": The killer's kill cooldown is not ready.
 * - "not_impostor": The killer is not an impostor.
 */
export class PlayerMurderFailEvent extends BasicEvent {
    static eventName = "player.murderfail" as const;
    eventName = "player.murderfail" as const;

    constructor(
        public readonly room: Room,
        /**
         * The player who attempted the murder.
         */
        public readonly player: Player<Room>,
        /**
         * The intended target of the murder.
         */
        public readonly target: Player<Room>,
        /**
         * The reason the murder failed.
         */
        public readonly reason: "protected" | "already_dead" | "invulnerable" | "in_vent" | "cooldown" | "not_impostor" | string,
        /**
         * Optional additional details about the failure.
         */
        public readonly details?: string,
    ) {
        super();
    }
}
