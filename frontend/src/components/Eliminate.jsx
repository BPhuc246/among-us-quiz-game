import { useEffect, useState } from "react";
import { getCharacterAvatar } from "../utils/characterAvatar.js";
import styles from "./Eliminate.module.css";

const ASSET_ROOT = "/assets/eliminate";
const ELIMINATE_SOUND = `${ASSET_ROOT}/eliminate_sound.MP3`;

export default function Eliminate({ player }) {
    const [avatar, setAvatar] = useState(null);

    useEffect(() => {
        let cancelled = false;
        if (!player?.color) {
            setAvatar(null);
            return undefined;
        }

        getCharacterAvatar(player.color)
            .then((src) => {
                if (!cancelled) setAvatar(src);
            })
            .catch((error) => {
                console.warn("Could not create eliminated-player avatar:", error);
                if (!cancelled) setAvatar(null);
            });

        return () => {
            cancelled = true;
        };
    }, [player?.color]);

    useEffect(() => {
        const audio = new Audio(ELIMINATE_SOUND);
        audio.preload = "auto";
        audio.volume = 0.9;

        let disposed = false;
        let started = false;
        let pending = false;

        const removeUnlockListeners = () => {
            window.removeEventListener("pointerdown", startAudio);
            window.removeEventListener("keydown", startAudio);
        };

        const startAudio = () => {
            if (disposed || started || pending) return;
            pending = true;
            audio.currentTime = 0;

            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === "function") {
                playPromise
                    .then(() => {
                        started = true;
                        pending = false;
                        removeUnlockListeners();
                    })
                    .catch((error) => {
                        pending = false;
                        console.warn("Elimination sound could not start automatically:", error);
                    });
            } else {
                started = true;
                pending = false;
                removeUnlockListeners();
            }
        };

        audio.addEventListener("canplaythrough", startAudio, { once: true });
        window.addEventListener("pointerdown", startAudio, { once: true });
        window.addEventListener("keydown", startAudio, { once: true });
        audio.load();
        startAudio();

        return () => {
            disposed = true;
            removeUnlockListeners();
            audio.removeEventListener("canplaythrough", startAudio);
            audio.pause();
            audio.currentTime = 0;
            audio.src = "";
        };
    }, []);

    if (!player) return null;

    const message = player.isImposter
        ? `${player.name} was the Imposter`
        : `${player.name} was not The Imposter`;

    return (
        <div
            className={styles.overlay}
            role="dialog"
            aria-label={`Eliminated: ${message}`}
        >
            <div className={styles.fadeIn} />

            <div className={styles.flightPath} aria-hidden="true">
                {avatar ? (
                    <img
                        className={styles.character}
                        src={avatar}
                        alt=""
                        draggable="false"
                    />
                ) : (
                    <div
                        className={styles.characterFallback}
                        style={{ backgroundColor: player.color || "#888888" }}
                    />
                )}
            </div>

            <p className={styles.resultText}>{message}</p>
        </div>
    );
}
