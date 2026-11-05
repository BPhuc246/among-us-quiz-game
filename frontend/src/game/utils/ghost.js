export const GHOST_FRAME_COUNT = 48;
export const GHOST_SPEED = 160;       // tốc độ ma (player thường là 100)
export const GHOST_SCALE = 0.2;       // chỉnh cho bằng kích thước player
export const GHOST_ALPHA = 0.7;
export const DEATH_SCREEN_MS = 3000;  // thời gian màn hình đỏ

const GHOST_ANIM = 'ghostFloat';

const ghostKey = (i) => `ghost${String(i).padStart(4, '0')}`;

/** Gọi trong preload() của scene */
export function preloadGhostFrames(scene) {
    for (let i = 1; i <= GHOST_FRAME_COUNT; i++) {
        const key = ghostKey(i);
        scene.load.image(key, `assets/sprites/Base/ghost/${key}.png`);
    }
}

/** Gọi trong create() của scene */
export function createGhostAnimation(scene) {
    if (scene.anims.exists(GHOST_ANIM)) return;

    const frames = [];
    for (let i = 1; i <= GHOST_FRAME_COUNT; i++) {
        frames.push({ key: ghostKey(i) });
    }
    scene.anims.create({
        key: GHOST_ANIM,
        frames,
        frameRate: 12,
        repeat: -1
    });
}

/** Sprite ma của chính người chơi, di chuyển bằng physics, không va chạm tường */
export function createGhostSprite(scene, x, y) {
    const ghost = scene.physics.add.sprite(x, y, ghostKey(1))
        .setScale(GHOST_SCALE)
        .setAlpha(GHOST_ALPHA)
        .setDepth(700);
    ghost.body.setAllowGravity(false);
    ghost.alive = true;
    scene.worldContainer.add(ghost);
    ghost.play(GHOST_ANIM);
    return ghost;
}

/** Di chuyển ma của local player, gọi thay cho handleMovement thường */
export function updateGhostMovement(scene) {
    const ghost = scene.player;
    if (!ghost || !ghost.body) return;

    let vx = 0;
    let vy = 0;
    if (scene.wKey.isDown) vy -= GHOST_SPEED;
    if (scene.sKey.isDown) vy += GHOST_SPEED;
    if (scene.aKey.isDown) { vx -= GHOST_SPEED; scene.playerObj.state.d = 'left'; }
    if (scene.dKey.isDown) { vx += GHOST_SPEED; scene.playerObj.state.d = 'right'; }

    if (vx !== 0 && vy !== 0) {
        vx *= 0.707;
        vy *= 0.707;
    }

    ghost.body.setVelocity(vx, vy);
    if (vx < 0) ghost.flipX = true;
    else if (vx > 0) ghost.flipX = false;

    const moving = vx !== 0 || vy !== 0;
    if (!ghost.anims.isPlaying) ghost.play(GHOST_ANIM, true);

    if (moving || scene.wasMoving) {
        scene.socket?.emit('player:move', {
            id: scene.playerObj.id,
            x: ghost.x,
            y: ghost.y,
            roomId: scene.room.id,
            d: scene.playerObj.state.d,
            moving
        });
    }
    scene.wasMoving = moving;
}

/** Tạo / cập nhật sprite ma của người khác (chỉ tồn tại trên client của ma) */
function upsertRemoteGhost(scene, data) {
    if (!data || String(data.id) === String(scene.playerObj?.id)) return;

    let sprite = scene.ghosts[data.id];
    if (!sprite) {
        sprite = scene.add.sprite(data.x ?? 0, data.y ?? 0, ghostKey(1))
            .setScale(GHOST_SCALE)
            .setAlpha(GHOST_ALPHA)
            .setDepth(700);
        scene.worldContainer.add(sprite);
        sprite.play(GHOST_ANIM);
        scene.ghosts[data.id] = sprite;
    }
    if (typeof data.x === 'number' && typeof data.y === 'number') {
        sprite.setPosition(data.x, data.y);
    }
    if (data.d) sprite.flipX = data.d === 'left';
}

function removeRemoteGhost(scene, id) {
    const sprite = scene.ghosts?.[id];
    if (!sprite) return;
    sprite.destroy();
    delete scene.ghosts[id];
}

/** Lắng nghe sự kiện liên quan đến ma. Người sống không nhận được các sự kiện này. */
export function attachGhostListeners(scene) {
    const socket = scene.socket;
    if (!socket) return;

    scene._onGhostSnapshot = (list) => {
        (Array.isArray(list) ? list : []).forEach((g) => upsertRemoteGhost(scene, g));
    };
    scene._onGhostJoined = (g) => upsertRemoteGhost(scene, g);
    scene._onGhostMoved = (data) => {
        const sprite = scene.ghosts?.[data.id];
        if (!sprite) return;
        sprite.setPosition(data.x, data.y);
        if (data.d) sprite.flipX = data.d === 'left';
    };
    scene._onGhostLeft = (data) => removeRemoteGhost(scene, data.playerId);

    socket.on('ghost:snapshot', scene._onGhostSnapshot);
    socket.on('ghost:joined', scene._onGhostJoined);
    socket.on('player:moved', scene._onGhostMoved);
    socket.on('player:left', scene._onGhostLeft);
}

export function detachGhostListeners(scene) {
    const socket = scene.socket;
    if (socket) {
        if (scene._onGhostSnapshot) socket.off('ghost:snapshot', scene._onGhostSnapshot);
        if (scene._onGhostJoined) socket.off('ghost:joined', scene._onGhostJoined);
        if (scene._onGhostMoved) socket.off('player:moved', scene._onGhostMoved);
        if (scene._onGhostLeft) socket.off('player:left', scene._onGhostLeft);
    }
    scene._onGhostSnapshot = null;
    scene._onGhostJoined = null;
    scene._onGhostMoved = null;
    scene._onGhostLeft = null;
}

/** Màn hình đỏ nhấp nháy, phủ toàn màn hình, nằm trên UI camera */
export function showDeathOverlay(scene) {
    hideDeathOverlay(scene);

    const w = scene.scale.width;
    const h = scene.scale.height;
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0xff0000, 0.4)
        .setDepth(2000)
        .setScrollFactor(0);
    scene.ui.add(overlay);

    scene.deathOverlay = overlay;
    scene.deathOverlayTween = scene.tweens.add({
        targets: overlay,
        alpha: { from: 0.25, to: 0.6 },
        duration: 400,
        yoyo: true,
        repeat: -1
    });
}

export function hideDeathOverlay(scene) {
    scene.deathOverlayTween?.stop();
    scene.deathOverlayTween = null;
    scene.deathOverlay?.destroy();
    scene.deathOverlay = null;
}