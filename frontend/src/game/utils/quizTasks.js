import { EventBus } from "../EventBus.js";

export function setupQuizTasks(scene) {
    scene.quizOpen = false;
    scene.quizTasks = [];
    scene.quizMarkers = [];
    scene.onQuizState = (state) => {
        if (state.roomId !== scene.room.id) return;
        scene.quizTasks = state.tasks;
        scene.quizUseRadius = state.useRadius;
        scene.quizMarkers.forEach((marker) => marker.destroy());
        scene.quizMarkers = [];
        const stations = new Map();
        state.tasks.filter((task) => !task.completed).forEach((task) => stations.set(task.station.id, task.station));
        stations.forEach((station) => {
            const marker = scene.add.container(station.x, station.y).setDepth(550);
            const ring = scene.add.circle(0, 0, 11, 0xffd54a, 0.25).setStrokeStyle(2, 0xffd54a);
            const label = scene.add.text(0, 0, "?", { fontFamily: "Arial", fontSize: "16px", fontStyle: "bold", color: "#fff0a8" }).setOrigin(0.5);
            marker.add([ring, label]);
            scene.worldContainer.add(marker);
            scene.quizMarkers.push(marker);
        });
        scene.lastQuizHint = null;
    };
    scene.onQuizUse = () => {
        const task = scene.nearbyQuizTask;
        if (!task || scene.quizOpen || scene.meetingActive || scene.imposter) return;
        scene.quizOpen = true;
        scene.player.body.setVelocity(0, 0);
        scene.input.keyboard.resetKeys();
        scene.input.keyboard.enabled = false;
        if (!scene.isGhost) {
            scene.player.anims.stop();
            scene.player.setTexture("idleImage");
        }
        scene.socket.emit("player:move", {
            roomId: scene.room.id, id: scene.playerObj.id,
            x: scene.player.x, y: scene.player.y, d: scene.playerObj.state.d, moving: false,
        });
        EventBus.emit("quiz:open", task.id);
    };
    scene.onQuizClose = () => {
        scene.quizOpen = false;
        scene.input.keyboard.enabled = true;
        scene.input.keyboard.resetKeys();
    };
    scene.socket.on("game:tasks", scene.onQuizState);
    EventBus.on("quiz:use", scene.onQuizUse);
    EventBus.on("quiz:close", scene.onQuizClose);
    scene.input.keyboard.on("keydown-E", scene.onQuizUse);
    scene.socket.emit("tasks:get", { roomId: scene.room.id });
}

export function updateQuizTasks(scene) {
    if (!scene.quizTasks) return;
    let nearest = null;
    let distance = Infinity;
    scene.quizTasks.filter((task) => !task.completed).forEach((task) => {
        const dist = Math.hypot(scene.player.x - task.station.x, scene.player.y - task.station.y);
        if (dist < distance) { nearest = task; distance = dist; }
    });
    scene.nearbyQuizTask = !scene.meetingActive && distance <= scene.quizUseRadius ? nearest : null;
    scene.quizMarkers.forEach((marker) => {
        marker.visible = !scene.meetingActive && (scene.isGhost || Math.hypot(marker.x - scene.player.x, marker.y - scene.player.y) <= scene.VISION_RADIUS);
    });
    const dx = nearest ? nearest.station.x - scene.player.x : 0;
    const dy = nearest ? nearest.station.y - scene.player.y : 0;
    const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "→" : "←") : (dy > 0 ? "↓" : "↑");
    const hint = { taskId: nearest?.id, distance: Math.round(distance), direction, canUse: !!scene.nearbyQuizTask, isGhost: !!scene.isGhost };
    const key = JSON.stringify(hint);
    if (key !== scene.lastQuizHint) {
        scene.lastQuizHint = key;
        EventBus.emit("quiz:nearby", hint);
    }
}

export function cleanupQuizTasks(scene) {
    if (scene.onQuizState) scene.socket?.off("game:tasks", scene.onQuizState);
    if (scene.onQuizUse) {
        EventBus.off("quiz:use", scene.onQuizUse);
        scene.input.keyboard?.off("keydown-E", scene.onQuizUse);
    }
    if (scene.onQuizClose) EventBus.off("quiz:close", scene.onQuizClose);
    if (scene.input.keyboard) scene.input.keyboard.enabled = true;
    EventBus.emit("quiz:cancel");
}
