import { RoomsManager } from "../managers/rooms.manager.js";
import { TasksManager } from "../managers/tasks.manager.js";

export function registerTaskEvents(io, socket) {
    socket.on("tasks:get", (data = {}) => {
        if (!data || typeof data.roomId !== "string") return;
        const room = RoomsManager.fetchRoom(data.roomId);
        const playerId = socket.data.playerId;
        if (!room?.started || !room.players[playerId] || !socket.rooms.has(room.id)) return;
        socket.emit("game:tasks", TasksManager.snapshot(room, playerId));
    });

    socket.on("task:answer", (data = {}, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        if (!data || typeof data.roomId !== "string") {
            reply({ ok: false, message: "Thiếu mã phòng hợp lệ." });
            return;
        }
        const room = RoomsManager.fetchRoom(data.roomId);
        const playerId = socket.data.playerId;
        if (!room || !socket.rooms.has(room.id)) {
            reply({ ok: false, message: "Bạn không ở trong phòng này." });
            return;
        }
        const result = TasksManager.submit(room, playerId, data.taskId, data.optionIndex);
        reply({ ...result, taskId: data.taskId });
        if (!result.ok) return;
        socket.emit("game:tasks", TasksManager.snapshot(room, playerId));
        const progress = TasksManager.progress(room);
        io.to(room.id).emit("game:task-progress", { roomId: room.id, ...progress });
        if (progress.total > 0 && progress.completed === progress.total && room.started) {
            room.started = false;
            io.to(room.id).emit("game:ended", { roomId: room.id, isImposter: false, reason: "tasks" });
        }
    });
}
