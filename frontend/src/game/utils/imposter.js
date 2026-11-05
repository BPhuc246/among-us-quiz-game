export const KILL_ZONE_RADIUS = 60;     // px
export const KILL_COOLDOWN_MS = 20000;  // 20 giây, phải khớp với backend
const KILL_PENDING_TIMEOUT_MS = 3000;

/**
 * Khởi tạo UI và logic kill cho imposter
 */
export function handleImposter(scene) {
    if (!scene.imposter || !scene.player) return;

    scene.closest = { player: null };
    scene.killPending = false;
    scene.killCooldownUntil = 0;

    // Nút kill
    scene.killBtn = scene.add.image(820, 410, 'kill')
        .setScale(0.7)
        .setDepth(1000)
        .setScrollFactor(0)
        .setInteractive()
        .on('pointerdown', () => tryKill(scene));
    scene.ui.add(scene.killBtn);

    // Hiển thị thời gian cooldown còn lại
    scene.killCooldownText = scene.add.text(820, 460, '', {
        fontFamily: 'Arial Black',
        fontSize: 20,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(1001).setScrollFactor(0);
    scene.ui.add(scene.killCooldownText);

    // Lắng nghe kết quả kill từ server
    scene.onKillConfirmed = (data) => {
        if (String(data.killerId) !== String(scene.playerObj?.id)) return;
        scene.killPending = false;
        startCooldown(scene, KILL_COOLDOWN_MS);
    };

    scene.onKillRejected = (data) => {
        scene.killPending = false;
        if (data?.reason === 'COOLDOWN' && data.remainingMs > 0) {
            startCooldown(scene, data.remainingMs);
        }
    };

    scene.socket.on('player:killed', scene.onKillConfirmed);
    scene.socket.on('player:kill:rejected', scene.onKillRejected);
}

/**
 * Gỡ listener khi scene shutdown
 */
export function cleanupImposter(scene) {
    if (scene.socket) {
        if (scene.onKillConfirmed) scene.socket.off('player:killed', scene.onKillConfirmed);
        if (scene.onKillRejected) scene.socket.off('player:kill:rejected', scene.onKillRejected);
    }
    scene.onKillConfirmed = null;
    scene.onKillRejected = null;
}

/**
 * Gọi mỗi frame: cập nhật target gần nhất và trạng thái nút
 */
export function handleImposterMovement(scene) {
    if (!scene.imposter || !scene.killBtn || !scene.player) return;

    const target = findNearestTarget(scene);
    scene.closest = { player: target };

    const ready = !!target && !isOnCooldown(scene) && !scene.killPending;
    const isGray = scene.killBtn.pipeline?.name === 'GrayScale';

    if (ready && isGray) {
        scene.killBtn.resetPipeline();
    } else if (!ready && !isGray) {
        scene.killBtn.setPipeline('GrayScale');
    }

    updateCooldownText(scene);
}

/**
 * Trả về người chơi còn sống gần nhất trong tầm kill, hoặc null
 */
export function findNearestTarget(scene) {
    if (!scene.player) return null;

    let best = null;
    let bestDist = Infinity;

    Object.values(scene.players).forEach((p) => {
        if (!isKillable(scene, p)) return;

        const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, p.x, p.y);
        if (dist <= KILL_ZONE_RADIUS && dist < bestDist) {
            best = p;
            bestDist = dist;
        }
    });

    return best;
}

function isKillable(scene, p) {
    if (!p || p === scene.player) return false;   // không tự kill mình
    if (p.alive === false) return false;          // đã chết
    if (!p.scene) return false;                   // sprite đã bị destroy
    return true;
}

function tryKill(scene) {
    if (!scene.imposter || !scene.killBtn) return;
    if (scene.killPending || isOnCooldown(scene)) return;

    const target = findNearestTarget(scene);
    if (!target) return;

    scene.killPending = true;
    // Phòng trường hợp server không phản hồi
    scene.time.delayedCall(KILL_PENDING_TIMEOUT_MS, () => {
        scene.killPending = false;
    });

    scene.socket.emit('player:kill', {
        playerId: target.id,
        killerId: scene.playerObj.id,
        roomId: scene.room.id,
        x: target.x,
        y: target.y,
        color: scene.playerObj.color
    });
    // Không teleport cục bộ: server sẽ gửi player:killed để mọi client (kể cả killer) cập nhật vị trí
}

function isOnCooldown(scene) {
    return scene.time.now < scene.killCooldownUntil;
}

function startCooldown(scene, ms) {
    scene.killCooldownUntil = scene.time.now + ms;
}

function updateCooldownText(scene) {
    if (!scene.killCooldownText) return;
    const remaining = scene.killCooldownUntil - scene.time.now;
    const text = remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : '';
    if (scene.killCooldownText.text !== text) {
        scene.killCooldownText.setText(text);
    }
}