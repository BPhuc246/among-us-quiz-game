import { useState, useEffect } from "react";
import styles from "./meetingTile.module.css";
import { getCharacterAvatarVoting } from "../utils/characterAvatar.js";

// Public assets
const playerIcon = "/assets/meeting/pfp.png";
const voteIcon = "/assets/meeting/voted.png";
const ivotedIcon = "/assets/meeting/ivoted.png";
const cancelIcon = "/assets/meeting/cancel.png";
const confirmIcon = "/assets/meeting/confirm.png";
const deadIcon = "/assets/meeting/deaded.png";

export default function MeetingTile({
  player,
  votes = [],
  VoteCallBack,
  canVote = false,
}) {
  const [selected, setSelected] = useState(false);
  const [localPlayerVoted, setLocalPlayerVoted] = useState(false);
  const [avatar, setAvatar] = useState(playerIcon);

  // sessionStorage luôn trả về chuỗi, nên ép cả hai về String để so sánh đúng
  const localPlayerId = sessionStorage.getItem("playerId");
  const isLocalPlayer =
    localPlayerId !== null && String(player.id) === String(localPlayerId);

  // Người đã chết: isAlive === false (undefined vẫn coi là còn sống)
  const isAlive = player.isAlive !== false;

  // Người bấm được vote: đang còn sống, chưa vote, và tile này còn sống
  const canInteract = canVote && isAlive && !localPlayerVoted;

  // Chỉ chính imposter mới thấy tile của mình được tô đỏ
  const isLocalImposter = isLocalPlayer && player.isImposter === true;

  // Tên: imposter (đỏ) > người chơi hiện tại (xanh) > mặc định (đen)
  const nameStyle = isLocalImposter
    ? {
        color: "#ff3333",
        fontWeight: 900,
        textShadow: "0 0 8px rgba(255,0,0,0.7)",
      }
    : isLocalPlayer
      ? { color: "#1e90ff", fontWeight: 900, fontSize: "1.25rem" }
      : { color: "#000" };

  // Người đã chết: khung tile xám, không cho click.
  // Không dùng filter trên cả tile để dấu X đỏ không bị đổi sang xám.
  const tileDeadStyle = isAlive
    ? {}
    : {
        backgroundColor: "#d9d9d9",
        borderColor: "#888",
        cursor: "not-allowed",
      };

  // Avatar người chết chuyển trắng đen
  const avatarDeadStyle = isAlive ? {} : { filter: "grayscale(100%)" };

  // Tạo avatar có màu
  useEffect(() => {
    let cancelled = false;

    async function loadAvatar() {
      try {
        const coloredAvatar = await getCharacterAvatarVoting(player.color);
        if (!cancelled) setAvatar(coloredAvatar);
      } catch (error) {
        console.error("Failed to load player avatar:", error);
        if (!cancelled) setAvatar(playerIcon);
      }
    }

    loadAvatar();

    return () => {
      cancelled = true;
    };
  }, [player.color]);

  // Đóng menu xác nhận nếu không còn được phép vote
  useEffect(() => {
    if (!canInteract) setSelected(false);
  }, [canInteract]);

  // Xác nhận vote
  const handleConfirm = (e) => {
    e.stopPropagation();
    if (!canInteract) return;

    setSelected(false);
    VoteCallBack({
      callerId: localPlayerId,
      votedForId: player.id,
    });
    setLocalPlayerVoted(true);
  };

  // Hủy chọn
  const handleCancel = (e) => {
    e.stopPropagation();
    setSelected(false);
  };

  // Chọn người chơi: người chết hoặc không được vote thì không mở menu
  const handleTileClick = () => {
    if (!canInteract) return;
    setSelected((prev) => !prev);
  };

  const tileClasses = [
    styles.tile,
    !isAlive && styles.dead,
    isLocalPlayer && styles.ownPlayer,
    isLocalImposter && styles.imposter,
    selected && styles.selected,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={tileClasses}
      style={tileDeadStyle}
      onClick={handleTileClick}
      aria-disabled={!canInteract}
    >
      <div className="flex flex-row">
        <div className={styles.playerIcon} style={{ position: "relative" }}>
          <img
            src={avatar}
            alt={`${player.name} Avatar`}
            className={styles.iconImage}
            style={avatarDeadStyle}
          />

          {/* Dấu X đỏ đặt chồng lên avatar khi người chơi đã chết */}
          {!isAlive && (
            <img
              src={deadIcon}
              alt="Dead Icon"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          )}

          {player.voted && (
            <img
              src={ivotedIcon}
              alt="I Voted Icon"
              className={styles.ivoted}
            />
          )}
        </div>

        <div className={styles.textContainer}>
          <div className={styles.name} style={nameStyle}>
            {player.name}
          </div>

          <div className={styles.votesContainer}>
            {votes.map((vote) => (
              <div key={vote.id} className={styles.vote}>
                <img
                  src={voteIcon}
                  alt="Vote Icon"
                  className={styles.voteImage}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && canInteract && (
        <div
          className="flex justify-between items-center max-w-[60px]"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={confirmIcon}
            alt="Confirm Icon"
            className="h-1/2 cursor-pointer"
            onClick={handleConfirm}
          />
          <img
            src={cancelIcon}
            alt="Cancel Icon"
            className="h-1/2 cursor-pointer"
            onClick={handleCancel}
          />
        </div>
      )}
    </div>
  );
}
