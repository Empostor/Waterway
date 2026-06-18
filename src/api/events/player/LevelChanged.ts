import { BasicEvent } from "@skeldjs/events";
import { Player } from "@skeldjs/au-core";

import { Room } from "../../../Room";

/**
 * Emitted when a player's level changes (via SetLevel RPC).
 */
export class PlayerLevelChangedEvent extends BasicEvent {
    static eventName = "player.levelchanged" as const;
    eventName = "player.levelchanged" as const;

    constructor(
        public readonly room: Room,
        /**
         * The player whose level changed.
         */
        public readonly player: Player<Room>,
        /**
         * The player's previous level.
         */
        public readonly oldLevel: number,
        /**
         * The player's new level.
         */
        public readonly newLevel: number,
    ) {
        super();
    }
}
