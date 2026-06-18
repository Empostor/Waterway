import { BasicEvent } from "@skeldjs/events";
import { Player } from "@skeldjs/au-core";

import { Room } from "../../../Room";

/**
 * Emitted when a player starts a task.
 */
export class PlayerTaskStartedEvent extends BasicEvent {
    static eventName = "player.taskstarted" as const;
    eventName = "player.taskstarted" as const;

    constructor(
        public readonly room: Room,
        /**
         * The player who started the task.
         */
        public readonly player: Player<Room>,
        /**
         * The type of task (from TaskType enum).
         */
        public readonly taskType: number,
        /**
         * The unique task ID.
         */
        public readonly taskId: number,
    ) {
        super();
    }
}
