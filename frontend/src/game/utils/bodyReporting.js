export const REPORT_RADIUS = 60;

export function addDeadBody(scene, data, applyColor) {
    if (scene.deadBodies.has(data.playerId)) return;
    const sprite = scene.add.sprite(data.x, data.y, "death", "Dead0001")
        .setScale(0.125).setDepth(500);
    scene.worldContainer.add(sprite);
    applyColor(scene, sprite, data.color);
    sprite.playerId = data.playerId;
    scene.deadBodies.set(data.playerId, sprite);
    // Remain on the last frame (the corpse). No delayed creation after cleanup.
    sprite.anims.play("deathAnim");
    return sprite;
}

export function clearDeadBodies(scene) {
    for (const body of scene.deadBodies?.values() || []) {
        body.anims.stop();
        body.destroy();
    }
    scene.deadBodies?.clear();
    scene.nearestBody = null;
    scene.reportBtn?.setVisible(false);
}

export function nearestReportableBody(scene) {
    if (!scene.player || scene.isGhost || scene.meetingActive || scene.quizOpen) return null;
    let nearest = null;
    let distance = REPORT_RADIUS;
    for (const body of scene.deadBodies.values()) {
        const next = Math.hypot(scene.player.x - body.x, scene.player.y - body.y);
        if (next <= distance) { nearest = body; distance = next; }
    }
    return nearest;
}

export function setupBodyReporting(scene) {
    scene.reportPending = false;
    scene.reportBtn = scene.add.image(820, 560, "report")
        .setScale(0.7).setScrollFactor(0).setDepth(1000).setVisible(false).setInteractive();
    scene.ui.add(scene.reportBtn);
    scene.onReportBody = () => {
        const body = nearestReportableBody(scene);
        if (!body || scene.reportPending) return;
        scene.reportPending = true;
        scene.socket.emit("player:move", {
            roomId: scene.room.id, id: scene.playerObj.id, x: scene.player.x, y: scene.player.y,
            d: scene.playerObj.state.d, moving: false,
        });
        scene.socket.timeout(8000).emit("body:report", { roomId: scene.room.id, bodyId: body.playerId }, (error, result) => {
            if (!scene.sys.isActive()) return;
            scene.reportPending = false;
            if (error || !result?.ok) window.showToast?.(result?.message || "Chưa nhận được phản hồi báo xác. Hãy thử lại.", "warning", 3000);
        });
    };
    scene.reportBtn.on("pointerdown", scene.onReportBody);
    scene.input.keyboard.on("keydown-R", scene.onReportBody);
}

export function updateBodyReporting(scene) {
    for (const body of scene.deadBodies.values()) {
        body.visible = scene.isGhost || !scene.visionEnabled ||
            Math.hypot(scene.player.x - body.x, scene.player.y - body.y) <= scene.VISION_RADIUS;
    }
    scene.nearestBody = nearestReportableBody(scene);
    scene.reportBtn?.setVisible(!!scene.nearestBody && !scene.reportPending);
}

export function cleanupBodyReporting(scene) {
    if (scene.onReportBody) scene.input.keyboard.off("keydown-R", scene.onReportBody);
    clearDeadBodies(scene);
}
