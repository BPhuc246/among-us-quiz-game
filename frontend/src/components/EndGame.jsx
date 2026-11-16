import { useEffect, useRef, useState } from "react";
import styles from "./EndGame.module.css";
import Button from "./Button";
import { getCharacterAvatar } from "../utils/characterAvatar.js";

const ASSET_ROOT = "/assets/role-scenes";

export default function EndGame({ result, onBackToMenu, isLocalPlayerImposter, playerColor }) {
    const isImposterWin = Boolean(result?.isImposter);
    const isVictory = isLocalPlayerImposter ? isImposterWin : !isImposterWin;
    const [avatar, setAvatar] = useState(null);
    const backToMenuRef = useRef(onBackToMenu);

    useEffect(() => {
        backToMenuRef.current = onBackToMenu;
    }, [onBackToMenu]);

    useEffect(() => {
        let cancelled = false;
        if (playerColor) {
            getCharacterAvatar(playerColor)
                .then((src) => { if (!cancelled) setAvatar(src); })
                .catch((error) => console.warn("Could not create end-game avatar:", error));
        }
        return () => { cancelled = true; };
    }, [playerColor]);

    useEffect(() => {
        // Do not use a "played" ref here: React StrictMode intentionally runs
        // effect setup -> cleanup -> setup in development. A ref guard would
        // let the first setup play, cleanup stop it, and then block the second
        // setup, resulting in silence.
        const soundFile = isLocalPlayerImposter
            ? "Imposter_victory_and_defeat_sound.MP3"
            : "Crewmate_victory_and_defeat_sound.MP3";
        const audio = new Audio(`${ASSET_ROOT}/${soundFile}`);
        audio.preload = "auto";
        audio.volume = 0.9;

        let disposed = false;
        let hasStarted = false;
        let playPending = false;
        const startAudio = () => {
            if (disposed || hasStarted || playPending) return;
            playPending = true;
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === "function") {
                playPromise.then(() => {
                    hasStarted = true;
                    playPending = false;
                    removeUnlockListeners();
                }).catch((error) => {
                    playPending = false;
                    // If autoplay is blocked, retry on the next real user gesture.
                    // This also covers browsers that require an interaction per page.
                    console.warn("End-game audio could not start automatically:", error);
                });
            } else {
                hasStarted = true;
                playPending = false;
                removeUnlockListeners();
            }
        };
        const removeUnlockListeners = () => {
            window.removeEventListener("pointerdown", startAudio);
            window.removeEventListener("keydown", startAudio);
        };

        audio.addEventListener("canplaythrough", startAudio, { once: true });
        window.addEventListener("pointerdown", startAudio, { once: true });
        window.addEventListener("keydown", startAudio, { once: true });
        audio.load();
        // Try immediately as well; the browser will queue playback when allowed.
        startAudio();

        const timeout = window.setTimeout(() => backToMenuRef.current?.(), 7800);
        return () => {
            disposed = true;
            window.clearTimeout(timeout);
            removeUnlockListeners();
            audio.removeEventListener("canplaythrough", startAudio);
            audio.pause();
            audio.currentTime = 0;
            audio.src = "";
        };
    }, [isLocalPlayerImposter]);

    const background = isVictory
        ? `${ASSET_ROOT}/Victory_background_demo.png`
        : `${ASSET_ROOT}/Defeat_background_demo.png`;

    return (
        <div
            className={styles.endGameOverlay}
            style={{ backgroundImage: `url("${background}")` }}
            role="dialog"
            aria-label={isVictory ? "Victory" : "Defeat"}
        >
            <div className={styles.fadeLayer} />
            <div className={styles.characterContainer}>
                {avatar ? (
                    <img className={styles.character} src={avatar} alt="Your character" />
                ) : playerColor ? (
                    <div className={styles.characterFallback} style={{ backgroundColor: playerColor }} />
                ) : null}
            </div>
            {result?.reason === "tasks" && !isImposterWin && (
                <p className={styles.reason}>The crew completed all tasks</p>
            )}
            <Button onClick={() => backToMenuRef.current?.()} className={styles.menuBtn}>
                Return to Menu
            </Button>
        </div>
    );
}
