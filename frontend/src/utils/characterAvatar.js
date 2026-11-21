/**
 * Tạo ảnh nhân vật theo màu người chơi cho UI React.
 *
 * Quy tắc recolor:
 * - Pixel đỏ (thân) -> màu người chơi * r
 * - Pixel xanh (bóng) -> màu người chơi * 0.5 * b
 * - Các pixel còn lại (kính, viền...) giữ nguyên.
 */

const SPRITE_URL = "/assets/sprites/Base/idle.png";
const SPRITE_URL_VOTE = "/assets/meeting/pfp.png";

/**
 * Cache ảnh đã load theo URL.
 * @type {Map<string, Promise<HTMLImageElement>>}
 */
const spritePromises = new Map();

/**
 * Cache ảnh đã recolor.
 * Key bao gồm URL + màu để tránh xung đột giữa hai sprite.
 * @type {Map<string, Promise<string>>}
 */
const avatarCache = new Map();

/**
 * Load ảnh.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadSprite(url) {
    if (!spritePromises.has(url)) {
        const promise = new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => resolve(img);

            img.onerror = (error) => {
                spritePromises.delete(url);
                reject(error);
            };

            img.src = url;
        });

        spritePromises.set(url, promise);
    }

    return spritePromises.get(url);
}

/**
 * Convert HEX to RGB.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex || "");

    if (!match) {
        return [136, 136, 136];
    }

    const n = parseInt(match[1], 16);

    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Recolor sprite theo màu người chơi.
 *
 * @param {string} spriteUrl
 * @param {string} color
 * @returns {Promise<string>}
 */
async function recolorSprite(spriteUrl, color) {
    const key = `${spriteUrl}:${(color || "").toLowerCase()}`;

    // Return cached avatar if available
    if (avatarCache.has(key)) {
        return avatarCache.get(key);
    }

    const job = loadSprite(spriteUrl).then((img) => {
        const canvas = document.createElement("canvas");

        // Giữ nguyên kích thước ảnh gốc
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("Cannot create canvas context");
        }

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const pixels = imageData.data;

        const [cr, cg, cb] = hexToRgb(color);

        const threshold = 0.4 * 255;

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Pixel đỏ: thân nhân vật
            if (r > threshold && g < threshold && b < threshold) {
                const factor = r / 255;

                pixels[i] = cr * factor;
                pixels[i + 1] = cg * factor;
                pixels[i + 2] = cb * factor;
            }

            // Pixel xanh: bóng nhân vật
            else if (b > threshold && r < threshold && g < threshold) {
                const factor = (b / 255) * 0.5;

                pixels[i] = cr * factor;
                pixels[i + 1] = cg * factor;
                pixels[i + 2] = cb * factor;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        return canvas.toDataURL("image/png");
    });

    // Cache promise để tránh xử lý cùng một ảnh nhiều lần
    avatarCache.set(key, job);

    // Xóa cache nếu xử lý thất bại
    job.catch(() => {
        avatarCache.delete(key);
    });

    return job;
}

// ====================== GAME SPRITE ======================

/**
 * Tạo avatar từ idle.png.
 *
 * @param {string} color
 * @returns {Promise<string>}
 */
export function getCharacterAvatar(color) {
    return recolorSprite(SPRITE_URL, color);
}

// ====================== VOTING SPRITE ======================

/**
 * Tạo avatar từ pfp.png.
 *
 * @param {string} color
 * @returns {Promise<string>}
 */
export function getCharacterAvatarVoting(color) {
    return recolorSprite(SPRITE_URL_VOTE, color);
}
