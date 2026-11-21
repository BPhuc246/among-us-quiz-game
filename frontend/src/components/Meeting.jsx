import { useState } from "react";
import styles from "./Meeting.module.css";
import Button from "./Button";
// Public assets are served from the project root; reference by URL instead of importing from public/
const screenImg = "/assets/meeting/screen.png";
import MeetingTile from "../components/MeetingTile.jsx";

function Meeting({ players, onVote, timeRemaining }) {
  const [hasVoted, setHasVoted] = useState(false);
  const playerList = Object.values(players || {});

  // Người chơi cục bộ có được vote không: phải tồn tại và còn sống
  const localPlayerId = sessionStorage.getItem("playerId");
  const localPlayer = playerList.find(
    (p) => String(p.id) === String(localPlayerId),
  );
  const canVote = !!localPlayer && localPlayer.isAlive !== false;

  return (
    <div className={styles.meetingOverlay}>
      <div className={styles.screenContent}>
        <div className={styles.contentWrapper}>
          <h1 className={styles.title}>Who is The Imposter?</h1>
          <div className={styles.content}>
            <div className={styles.playerGrid}>
              {playerList.map((player) => (
                <MeetingTile
                  key={player.id}
                  player={player}
                  name={player.name}
                  canVote={canVote}
                  VoteCallBack={onVote}
                />
              ))}
            </div>
            <div className={styles.timer}>
              Time Remaining: {Math.ceil(timeRemaining / 1000)}s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Meeting;
