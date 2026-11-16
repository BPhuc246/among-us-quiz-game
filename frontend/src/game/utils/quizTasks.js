import { EventBus } from "../EventBus.js";

/**
 * Chỉ đồng bộ tiến độ nhiệm vụ từ server.
 * Không còn marker "?" ngẫu nhiên và không còn phím E riêng:
 * việc tương tác do TaskManager (viền vàng) đảm nhiệm.
 */
export function setupQuizTasks(scene) {
    scene.quizTasks = [];
    scene.onQuizState = (state) => {
        if (state.roomId !== scene.room.id) return;
        scene.quizTasks = state.tasks;

        // Đồng bộ các ô đã hoàn thành (kể cả do người khác làm) để TaskManager ẩn viền vàng
        state.tasks
            .filter((task) => task.completed)
            .forEach((task) =>
                EventBus.emit("task:completed", { taskId: task.id }),
            );
    };
    scene.socket.on("game:tasks", scene.onQuizState);
    scene.socket.emit("tasks:get", { roomId: scene.room.id });
}

export function cleanupQuizTasks(scene) {
    if (scene.onQuizState) scene.socket?.off("game:tasks", scene.onQuizState);
    scene.onQuizState = null;
}
