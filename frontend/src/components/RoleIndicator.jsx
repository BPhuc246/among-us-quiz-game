import { useEffect, useMemo, useRef, useState } from "react";
import { getCharacterAvatar } from "../utils/characterAvatar.js";
import styles from "./RoleIndicator.module.css";

const ASSET_ROOT = "/assets/role-scenes";
const ROLE_SOUND = `${ASSET_ROOT}/your_role_is.mp3`;

function normalizeColors(colors, fallbackColor) {
    const source = Array.isArray(colors) && colors.length > 0
        ? colors
        : [fallbackColor];

    // Preserve duplicates: each crew member should get a sprite even if two
    // room members accidentally ended up with the same cosmetic color.
    return source.filter((color) => typeof color === "string" && color.trim());
}

export default function RoleIndicator({ role, crewColors = [], playerColor, onAnimationEnd }) {
    const isImposter = Boolean(role?.imposter);
    const colors = useMemo(
        () => isImposter ? [playerColor].filter(Boolean) : normalizeColors(crewColors, playerColor),
        [isImposter, crewColors, playerColor],
    );
    const [phase, setPhase] = useState("shh");
    const [videoFailed, setVideoFailed] = useState(false);
    const [avatars, setAvatars] = useState({});
    const onAnimationEndRef = useRef(onAnimationEnd);

    useEffect(() => {
        onAnimationEndRef.current = onAnimationEnd;
    }, [onAnimationEnd]);

    useEffect(() => {
        let cancelled = false;

        Promise.all(colors.map(async (color) => {
            try {
                return [color, await getCharacterAvatar(color)];
            } catch (error) {
                console.warn("Could not create role screen avatar for", color, error);
                return [color, null];
            }
        })).then((entries) => {
            if (!cancelled) setAvatars(Object.fromEntries(entries));
        });

        return () => { cancelled = true; };
    }, [colors]);

    // The source video is about 1.7 seconds. This timer is a fallback in case
    // the browser does not fire `ended` (for example, when video decoding fails).
    useEffect(() => {
        if (phase !== "shh") return undefined;
        const timeout = window.setTimeout(() => setPhase("fade"), 2100);
        return () => window.clearTimeout(timeout);
    }, [phase]);

    useEffect(() => {
        if (phase !== "fade") return undefined;
        const timeout = window.setTimeout(() => setPhase("role"), 650);
        return () => window.clearTimeout(timeout);
    }, [phase]);

    useEffect(() => {
        if (phase !== "role") return undefined;

        const audio = new Audio(ROLE_SOUND);
        audio.volume = 0.9;
        audio.play().catch((error) => {
            // Browsers may block autoplay for clients that did not interact locally.
            console.warn("Role audio was blocked by browser autoplay policy:", error);
        });

        const timeout = window.setTimeout(() => onAnimationEndRef.current?.(), 5800);
        return () => {
            window.clearTimeout(timeout);
            audio.pause();
            audio.currentTime = 0;
        };
    }, [phase]);

    const background = isImposter
        ? `${ASSET_ROOT}/Imposter_background_demo.png`
        : `${ASSET_ROOT}/Cremate_background_demo.png`;

    return (
        <div className={styles.overlay} role="dialog" aria-label="Assigned role">
            {phase === "shh" && (
                <div className={styles.shhStage}>
                    {videoFailed ? (
                        <img className={styles.shhImage} src={`${ASSET_ROOT}/Shh.png`} alt="Shhh" />
                    ) : (
                        <video
                            className={styles.shhVideo}
                            src={`${ASSET_ROOT}/Shh.mp4`}
                            autoPlay
                            playsInline
                            onCanPlay={(event) => {
                                event.currentTarget.play().catch(() => setVideoFailed(true));
                            }}
                            onEnded={() => setPhase("fade")}
                            onError={() => setVideoFailed(true)}
                        />
                    )}
                </div>
            )}

            {phase === "fade" && <div className={styles.fadeStage} />}

            {phase === "role" && (
                <div
                    className={`${styles.roleStage} ${isImposter ? styles.imposterStage : styles.crewmateStage}`}
                    style={{ backgroundImage: `url("${background}")` }}
                >
                    <div className={styles.characterRow}>
                        {colors.map((color, index) => (
                            <div className={styles.characterSlot} key={`${color}-${index}`}>
                                {avatars[color] ? (
                                    <img
                                        className={`${styles.character} ${isImposter ? styles.singleCharacter : ""}`}
                                        src={avatars[color]}
                                        alt={`${color} player`}
                                    />
                                ) : (
                                    <div className={styles.characterFallback} style={{ backgroundColor: color }} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
