import { BasicEvent } from "@skeldjs/events";
import { Player } from "@skeldjs/au-core";

import { Room } from "../../../Room";

/**
 * Emitted when a player's task progress updates.
 */
export class PlayerTaskProgressEvent extends BasicEvent {
    static eventName = "player.taskprogress" as const;
    eventName = "player.taskprogress" as const;

    constructor(
        public readonly room: Room,
        /**
         * The player whose task progressed.
         */
        public readonly player: Player<Room>,
        /**
         * The unique task ID.
         */
        public readonly taskId: number,
        /**
         * The current progress value (0-100 or game-specific).
         */
        public readonly progress: number,
    ) {
        super();
    }
}
