import { useState } from "react";
import { createPortal } from "react-dom";
import { EventBus } from "../game/EventBus.js";
import styles from "./GameActionBar.module.css";

const ICON_ROOT = "/assets/icons";
const ICONS = {
  task: `${ICON_ROOT}/solve.png`,
  meeting: `${ICON_ROOT}/useIcon.png`,
  kill: `${ICON_ROOT}/kill_icon.png`,
  report: `${ICON_ROOT}/reportBtn.png`,
  start: `${ICON_ROOT}/startBtn.png`,
  quit: `${ICON_ROOT}/quitbtn.png`,
};

/**
 * Thanh nút hành động ở góc dưới bên phải.
 * Render qua portal vào document.body để luôn nằm trên canvas Phaser.
 * - inWaiting: phòng chờ, hiện Start (host) hoặc Sẵn sàng (guest)
 * - inGame: hiện Nhiệm vụ, Họp (khi đứng trong vùng họp), Giết (imposter), Báo cáo
 * - Rời phòng và Chat luôn hiện
 */
export default function GameActionBar({
  inGame,
  inWaiting,
  isImposter,
  isHost,
  allGuestsReady,
  localIsReady,
  onStart,
  onToggleReady,
  onLeave,
  task,
  killTarget,
  reportTarget,
  canMeet,
  onMeet,
  chat,
}) {
  const showTask = inGame && Boolean(task?.visible);
  const showMeet = inGame && Boolean(canMeet);
  const showKill = inGame && isImposter;
  const showReport = inGame;
  const killReady = Boolean(task?.canKill) && Boolean(killTarget);
  const reportReady = Boolean(reportTarget);

  const bar = (
    <div className={styles.bar} aria-label="Hành động">
      {inWaiting && isHost && (
        <IconButton
          icon={ICONS.start}
          alt="Bắt đầu ván"
          caption={allGuestsReady ? "START" : "CHỜ"}
          disabled={!allGuestsReady}
          onClick={onStart}
        />
      )}

      {inWaiting && !isHost && (
        <IconButton
          icon={ICONS.start}
          alt={localIsReady ? "Hủy sẵn sàng" : "Sẵn sàng"}
          caption={localIsReady ? "HỦY" : "SẴN SÀNG"}
          active={localIsReady}
          onClick={onToggleReady}
        />
      )}

      {showTask && (
        <IconButton
          icon={ICONS.task}
          alt={task.isOpen ? "Đóng nhiệm vụ" : "Làm nhiệm vụ"}
          caption={task.isOpen ? "ĐÓNG" : "NHIỆM VỤ"}
          hotkey="E"
          active={task.isOpen}
          disabled={!task.canUse}
          onClick={task.onClick}
        />
      )}

      {showMeet && (
        <IconButton
          icon={ICONS.meeting}
          alt="Gọi họp"
          caption="HỌP"
          onClick={onMeet}
        />
      )}

      {showKill && (
        <IconButton
          icon={ICONS.kill}
          alt="Giết"
          caption="GIẾT"
          hotkey="Q"
          variant="kill"
          disabled={!killReady}
          onClick={() => EventBus.emit("kill:request", killTarget)}
        />
      )}

      {showReport && (
        <IconButton
          icon={ICONS.report}
          alt="Báo cáo xác"
          caption="BÁO CÁO"
          hotkey="R"
          disabled={!reportReady}
          onClick={() => EventBus.emit("report:request", reportTarget)}
        />
      )}

      {chat?.available && (
        <button
          type="button"
          className={`${styles.chatBtn} ${chat.open ? styles.chatActive : ""}`}
          onClick={chat.onToggle}
          aria-label={chat.open ? "Đóng chat" : "Mở chat"}
        >
          <span>CHAT</span>
          <kbd className={styles.kbd}>Enter</kbd>
          {chat.unread > 0 && !chat.open && (
            <span className={styles.badge}>
              {chat.unread > 99 ? "99+" : chat.unread}
            </span>
          )}
        </button>
      )}

      <IconButton
        icon={ICONS.quit}
        alt="Rời phòng"
        caption="RỜI"
        onClick={onLeave}
      />
    </div>
  );

  return createPortal(bar, document.body);
}

function IconButton({
  icon,
  alt,
  caption,
  hotkey,
  active,
  disabled,
  variant,
  onClick,
}) {
  const [broken, setBroken] = useState(false);

  return (
    <button
      type="button"
      className={`${styles.iconBtn} ${variant ? styles[variant] : ""} ${active ? styles.active : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={alt}
      title={hotkey ? `${alt} (${hotkey})` : alt}
    >
      <span className={styles.iconWrap}>
        {broken ? (
          <span className={styles.textFallback}>{caption}</span>
        ) : (
          <img
            src={icon}
            alt=""
            draggable={false}
            className={styles.icon}
            onError={() => setBroken(true)}
          />
        )}
      </span>
      <span className={styles.caption}>
        {caption}
        {hotkey && <kbd className={styles.kbd}>{hotkey}</kbd>}
      </span>
    </button>
  );
}
