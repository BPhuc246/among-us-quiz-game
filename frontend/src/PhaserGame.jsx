import { forwardRef, useEffect, useLayoutEffect, useRef } from "react";
import StartGame from "./game/main";
import { EventBus } from "./game/EventBus";

// Phải khớp width/height trong config Phaser ở game/main.js
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

/**
 * Giữ canvas có kích thước cố định trên màn hình khi người dùng đổi zoom trình duyệt (Ctrl +/-).
 * Khi zoom tăng, canvas được thu nhỏ bằng đúng tỉ lệ đó theo CSS pixel,
 * nên kích thước hiển thị thật của map không đổi.
 * @param {Phaser.Game} game
 * @returns {() => void} hàm hủy
 */
function lockCanvasToZoom(game) {
  const baseDpr = window.devicePixelRatio || 1;
  const canvas = game.canvas;

  const apply = () => {
    const ratio = baseDpr / (window.devicePixelRatio || 1);
    canvas.style.width = `${GAME_WIDTH * ratio}px`;
    canvas.style.height = `${GAME_HEIGHT * ratio}px`;
  };

  // Ngăn Phaser tự co giãn canvas theo cửa sổ (Scale.FIT)
  game.scale.stopListeners?.();

  apply();
  // Phaser có thể ghi đè style khi refresh nội bộ, nên áp lại sau mỗi lần đó
  game.events.on("ready", apply);
  game.scale.on("resize", apply);
  window.addEventListener("resize", apply);

  return () => {
    window.removeEventListener("resize", apply);
    game.scale.off("resize", apply);
    game.events.off("ready", apply);
  };
}

export const PhaserGame = forwardRef(function PhaserGame(
  { currentActiveScene },
  ref,
) {
  const game = useRef();
  const unlockZoomRef = useRef(null);

  // Create the game inside a useLayoutEffect hook to avoid the game being created outside the DOM
  useLayoutEffect(() => {
    if (game.current === undefined) {
      game.current = StartGame("game-container");
      unlockZoomRef.current = lockCanvasToZoom(game.current);

      if (ref && ref !== null) {
        ref.current = { game: game.current, scene: null };
      }
    }

    return () => {
      unlockZoomRef.current?.();
      unlockZoomRef.current = null;
      if (game.current) {
        game.current.destroy(true);
        game.current = undefined;
      }
    };
  }, [ref]);

  useEffect(() => {
    const onSceneReady = (currentScene) => {
      if (currentActiveScene instanceof Function) {
        currentActiveScene(currentScene);
      }
      if (ref && ref.current) {
        ref.current.scene = currentScene;
      }
    };

    EventBus.on("current-scene-ready", onSceneReady);
    return () => {
      EventBus.off("current-scene-ready", onSceneReady);
    };
  }, [currentActiveScene, ref]);

  return <div id="game-container"></div>;
});
