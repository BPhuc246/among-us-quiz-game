import { EventBus } from "../EventBus.js";

// Bán kính kill (px). Quyền giết và lượt giết do server quyết định.
export const KILL_ZONE_RADIUS = 60;
const KILL_PENDING_TIMEOUT_MS = 3000;

/**
 * Khởi tạo logic kill cho imposter. Không tạo nút Phaser: nút GIẾT nằm ở thanh React.
 * - Phaser báo người gần nhất qua "kill:nearby" để React bật nút GIẾT.
 * - Khi React gửi "kill:request", Phaser kiểm tra lại khoảng cách rồi gửi "player:kill" lên server.
 * @param {Phaser.Scene & Record<string, any>} scene
 */
export function handleImposter(scene) {
    if (!scene.imposter || !scene.player) return;

    scene.closest = { player: null };
    scene.killPending = false;
    scene.killPendingTimer = null;
    scene.lastNearbyId = null;

    scene.onKillRequest = (request) => tryKill(scene, request);
    scene.onKillConfirmed = (data) => {
        if (String(data?.killerId) !== String(scene.playerObj?.id)) return;
        clearPending(scene);
    };
    scene.onKillRejected = () => clearPending(scene);

    EventBus.on("kill:request", scene.onKillRequest);
    scene.socket?.on("player:killed", scene.onKillConfirmed);
    scene.socket?.on("player:kill:rejected", scene.onKillRejected);
}

/**
 * Gỡ listener và báo React xóa mục tiêu khi scene shutdown.
 * @param {Phaser.Scene & Record<string, any>} scene
 */
export function cleanupImposter(scene) {
    if (scene.onKillRequest) EventBus.off("kill:request", scene.onKillRequest);
    if (scene.socket) {
        if (scene.onKillConfirmed) {
            scene.socket.off("player:killed", scene.onKillConfirmed);
        }
        if (scene.onKillRejected) {
            scene.socket.off("player:kill:rejected", scene.onKillRejected);
        }
    }
    clearPending(scene);
    scene.onKillRequest = null;
    scene.onKillConfirmed = null;
    scene.onKillRejected = null;
    scene.lastNearbyId = null;
    EventBus.emit("kill:nearby", null);
}

/**
 * Gọi mỗi frame: tìm người gần nhất và báo lên React khi mục tiêu thay đổi.
 * @param {Phaser.Scene & Record<string, any>} scene
 */
export function handleImposterMovement(scene) {
    if (!scene.imposter || !scene.player) return;

    const target = findNearestTarget(scene);
    scene.closest = { player: target };

    const id = target ? String(target.id) : null;
    if (id === scene.lastNearbyId) return;
    scene.lastNearbyId = id;

    EventBus.emit(
        "kill:nearby",
        target ? { id, x: target.x, y: target.y } : null,
    );
}

/**
 * Trả về người chơi còn sống gần nhất trong tầm kill, hoặc null.
 * @param {Phaser.Scene & Record<string, any>} scene
 * @returns {any|null}
 */
export function findNearestTarget(scene) {
    if (!scene.player) return null;

    let best = null;
    let bestDist = Infinity;

    Object.values(scene.players ?? {}).forEach((p) => {
        if (!isKillable(scene, p)) return;

        const dist = Phaser.Math.Distance.Between(
            scene.player.x,
            scene.player.y,
            p.x,
            p.y,
        );
        if (dist <= KILL_ZONE_RADIUS && dist < bestDist) {
            best = p;
            bestDist = dist;
        }
    });

    return best;
}

/**
 * @param {Phaser.Scene & Record<string, any>} scene
 * @param {any} p
 * @returns {boolean}
 */
function isKillable(scene, p) {
    if (!p || p === scene.player) return false; // không tự kill mình
    if (p.alive === false) return false; // đã chết
    if (!p.scene) return false; // sprite đã bị destroy
    return true;
}

/**
 * Gửi yêu cầu giết lên server. Server vẫn kiểm tra lượt giết và trạng thái ván.
 * @param {Phaser.Scene & Record<string, any>} scene
 * @param {{id?: string}|null} request
 */
function tryKill(scene, request) {
    if (!scene.imposter || !scene.socket || !scene.room || !scene.playerObj) {
        return;
    }
    if (scene.killPending) return;

    const target = findNearestTarget(scene);
    if (!target) return;

    // Mục tiêu React gửi phải đúng với người đang gần nhất lúc bấm
    if (request?.id && String(request.id) !== String(target.id)) return;

    scene.killPending = true;
    scene.killPendingTimer = scene.time.delayedCall(
        KILL_PENDING_TIMEOUT_MS,
        () => {
            scene.killPending = false;
            scene.killPendingTimer = null;
        },
    );

    scene.socket.emit("player:kill", {
        playerId: target.id,
        killerId: scene.playerObj.id,
        roomId: scene.room.id,
        x: target.x,
        y: target.y,
        color: scene.playerObj.color,
    });
    // Không teleport cục bộ: server gửi player:killed để mọi client cập nhật vị trí
}

/**
 * @param {Phaser.Scene & Record<string, any>} scene
 */
function clearPending(scene) {
    scene.killPending = false;
    if (scene.killPendingTimer) {
        scene.killPendingTimer.remove?.(false);
        scene.killPendingTimer = null;
    }
}
