import { useState, useEffect, useRef } from "react";
import { PhaserGame } from "./PhaserGame";
import socketService from "./services/socket";
import Menu from "./pages/Menu.jsx";
import styles from "./App.module.css";
import Button from "./components/Button.jsx";
import Meeting from "./components/Meeting.jsx";
import EndGame from "./components/EndGame.jsx";
import { EventBus } from "./game/EventBus";
import RoleIndicator from "./components/RoleIndicator.jsx";
import Eliminate from "./components/Eliminate.jsx";
import { ToastContainer } from "./components/Toast.jsx";
import QuizTasks from "./components/QuizTasks.jsx";
import Chat from "./components/Chat.jsx";

const PAGES = {
  MENU: "lobby",
  WAITING: "waiting",
  GAME: "game",
  GAMEEND: "gameend",
};

function App() {
  const [currentPage, setCurrentPage] = useState(PAGES.MENU);
  const [roomId, setRoomId] = useState(null);
  const roomIdRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const playerIdRef = useRef(null);
  const [error, setError] = useState(null);
  const debug = useRef(import.meta.env.VITE_DEBUG === "true");
  const roleResolveRef = useRef(null);
  // Meeting state
  const [meetingActive, setMeetingActive] = useState(false);
  const [meetingData, setMeetingData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(60000);
  const [gameResult, setGameResult] = useState(null);
  const [isLocalPlayerImposter, setIsLocalPlayerImposter] = useState(false);
  const [isLocalPlayerHost, setIsLocalPlayerHost] = useState(false);
  const [roleIndicator, setRoleIndicator] = useState(false);
  const [roleRevealData, setRoleRevealData] = useState(null);
  const [localPlayerColor, setLocalPlayerColor] = useState(null);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [eliminationData, setEliminationData] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.showToast && !socketService.getSocket()?.connected) {
        window.showToast("Đang chờ kết nối máy chủ…", "warning", 4000);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    socketService.connect();
    const sockett = socketService.getSocket();
    if (!sockett) {
      console.warn("Socket unavailable after connect()");
      return;
    }
    setSocket(sockett);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleReadyUpdate = (data) => {
      if (data?.roomId !== roomIdRef.current) return;
      setLobbyPlayers(data.players || []);
    };
    const handleStartGame = (data) => {
      console.log(
        "Game started event received in App:",
        data,
        roomIdRef.current,
        data.roomId === roomIdRef.current,
      );
      if (data.roomId !== roomIdRef.current) return;

      data.playerId = playerIdRef.current;

      // Server gửi role riêng cho từng người chơi ngay sau game:started.
      // Phaser chỉ nhận boolean; React giữ toàn bộ role payload để dựng intro UI.
      const rolePromise = new Promise((resolve) => {
        roleResolveRef.current = resolve;
      });
      data.isImposter = rolePromise.then((roleInfo) =>
        Boolean(roleInfo?.isImposter),
      );
      data.showRoleIntro = true;

      EventBus.emit("start-game", data);
      setCurrentPage(PAGES.GAME);

      rolePromise.then((roleInfo) => {
        const isImposter = Boolean(roleInfo?.isImposter);
        setIsLocalPlayerImposter(isImposter);
        setLocalPlayerColor(roleInfo?.playerColor ?? null);
        setRoleRevealData({
          ...roleInfo,
          isImposter,
          crewColors: Array.isArray(roleInfo?.crewColors)
            ? roleInfo.crewColors
            : [],
        });
        setRoleIndicator(true);
      });
    };

    // Meeting Event from Phaser
    const handleMeetingStarted = (data) => {
      console.log("Meeting started in App:", data);
      setMeetingData(data);
      setMeetingActive(true);
      EventBus.emit("task:close"); // Mở khóa cờ taskModalOpen trong TaskManager
      setTimeRemaining(60000);
    };

    const handleMeetingEnded = (data) => {
      console.log("Meeting ended in App:", data);
      setMeetingActive(false);
      setMeetingData(null);
      setEliminationData(data?.results?.ejectedPlayer ?? null);
    };

    // The server ends this sequence after the 5-second ejection animation.
    // If the vote ended the game, keep this screen until game:ended arrives.
    const handleEliminationFinished = (data) => {
      if (data?.roomId && data.roomId !== roomIdRef.current) return;
      if (data?.gameEnded) return;
      setEliminationData(null);
      EventBus.emit("elimination:finished");
    };

    const handleGameEnd = (data) => {
      console.log("Game end event received in App:", data);
      if (data?.roomId && data.roomId !== roomIdRef.current) return;
      setRoleIndicator(false);
      setEliminationData(null);
      EventBus.emit("role:reveal:finished");
      EventBus.emit("elimination:finished");
      setGameResult(data);
      setCurrentPage(PAGES.GAMEEND);
    };

    const handleVote = (data) => {
      console.log("Vote event received in App:", data, meetingData);
      setMeetingData((prev) => ({
        ...prev,
        players: {
          ...prev.players,
          [data.callerId]: { ...prev.players[data.callerId], voted: true },
        },
      }));
    };

    const handleRole = (roleInfo) => {
      if (roleInfo?.roomId && roleInfo.roomId !== roomIdRef.current) return;
      roleResolveRef.current?.(roleInfo || {});
      roleResolveRef.current = null;
    };

    const handleNotif = (data) => {
      if (window.showToast) {
        window.showToast(data.message, "info", 3000);
      }
    };

    sockett.on("connect", handleConnect);
    sockett.on("disconnect", handleDisconnect);
    sockett.on("room:ready:update", handleReadyUpdate);
    sockett.on("game:started", handleStartGame);
    sockett.on("meeting:voted", handleVote);
    sockett.on("meeting:elimination:finished", handleEliminationFinished);
    sockett.on("game:notif", handleNotif);

    EventBus.on("meeting:started", handleMeetingStarted);
    EventBus.on("meeting:ended", handleMeetingEnded);
    EventBus.on("game:ended", handleGameEnd);
    sockett.on("game:role", handleRole);

    return () => {
      sockett.off("connect", handleConnect);
      sockett.off("disconnect", handleDisconnect);
      sockett.off("room:ready:update", handleReadyUpdate);
      sockett.off("game:started", handleStartGame);
      sockett.off("game:role", handleRole);
      sockett.off("meeting:voted", handleVote);
      sockett.off("meeting:elimination:finished", handleEliminationFinished);
      sockett.off("game:notif", handleNotif);
      EventBus.off("meeting:started", handleMeetingStarted);
      EventBus.off("meeting:ended", handleMeetingEnded);
      EventBus.off("game:ended", handleGameEnd);
    };
  }, []);

  const handleJoinRoom = (data) => {
    const joinedRoomId = data.roomId;
    playerIdRef.current = data.playerId;

    console.log("Joining room with ID:", joinedRoomId);
    setRoomId(joinedRoomId);
    roomIdRef.current = joinedRoomId;
    setCurrentPage(PAGES.WAITING);
    setIsLocalPlayerHost(data.isHost);
  };

  const handleStartGameBtn = () => {
    if (!allGuestsReady) {
      window.showToast?.("Chưa đủ người chơi sẵn sàng.", "warning", 3000);
      return;
    }
    socket.emit("game:start", { roomId });
  };

  const handleBackToMenu = () => {
    const playerId = sessionStorage.getItem("playerId");
    if (socket && playerId) socket.emit("room:leave", { playerId });
    EventBus.emit("task:close");
    setRoomId(null);
    setCurrentPage(PAGES.MENU);
    setLobbyPlayers([]);
    window.location.reload();
  };

  // Timer countdown for meeting
  useEffect(() => {
    if (!meetingActive) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [meetingActive]);

  const handleVoteCallBack = (data) => {
    data.roomId = roomId;
    socket.emit("meeting:vote", data);
  };

  const handleEndMeeting = () => {
    if (!socket || !roomId) return;
    console.log("Ending meeting");
    socket.emit("meeting:end", {
      roomId: roomId,
    });
  };

  const localLobbyPlayer = lobbyPlayers.find(
    (p) => p.id === playerIdRef.current,
  );
  const localIsReady = !!localLobbyPlayer?.isReady;
  const isHost = localLobbyPlayer ? localLobbyPlayer.isHost : isLocalPlayerHost;
  const guests = lobbyPlayers.filter((p) => !p.isHost);
  const allGuestsReady = guests.every((p) => p.isReady);

  const handleToggleReady = () => {
    if (!socket || !roomId) return;
    socket.emit("player:ready", { roomId, ready: !localIsReady });
  };

  return (
    <div id="app">
      <ToastContainer />
      <QuizTasks
        socket={socket}
        roomId={roomId}
        active={currentPage === PAGES.GAME}
      />
      {error && <p className={styles.error}>{error}</p>}
      {debug.current && (
        <div
          className={`${styles.statusBadge} ${isConnected ? styles.connected : styles.disconnected}`}
        >
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      )}
      {roleIndicator && roleRevealData && (
        <RoleIndicator
          role={{ imposter: roleRevealData.isImposter }}
          crewColors={roleRevealData.crewColors}
          playerColor={roleRevealData.playerColor}
          onAnimationEnd={() => {
            setRoleIndicator(false);
            EventBus.emit("role:reveal:finished");
          }}
        />
      )}

      {eliminationData && <Eliminate player={eliminationData} />}

      {currentPage === PAGES.MENU && <Menu onJoinGame={handleJoinRoom} />}

      {currentPage === PAGES.GAMEEND && (
        <EndGame
          result={gameResult}
          onBackToMenu={handleBackToMenu}
          isLocalPlayerImposter={isLocalPlayerImposter}
          playerColor={localPlayerColor}
        />
      )}

      {(currentPage === PAGES.GAME || currentPage === PAGES.WAITING) && (
        <div className={styles.gameContainer}>
          <PhaserGame />
          {currentPage === PAGES.WAITING && (
            <div
              style={{
                position: "absolute",
                top: 80,
                right: 20,
                background: "rgba(0,0,0,0.7)",
                padding: 16,
                borderRadius: 10,
                minWidth: 220,
                color: "#fff",
                zIndex: 10,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                Người chơi ({lobbyPlayers.length})
              </div>
              {lobbyPlayers.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      color: p.id === playerIdRef.current ? "#1e90ff" : "#fff",
                    }}
                  >
                    {p.name}
                    {p.isHost ? " (Host)" : ""}
                  </span>
                  <span
                    style={{
                      color: p.isHost
                        ? "#aaa"
                        : p.isReady
                          ? "#4caf50"
                          : "#ff9800",
                    }}
                  >
                    {p.isHost
                      ? "Host"
                      : p.isReady
                        ? "Sẵn sàng"
                        : "Chưa sẵn sàng"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {currentPage === PAGES.WAITING &&
            (isHost ? (
              <Button
                onClick={handleStartGameBtn}
                children={
                  allGuestsReady ? "Start Game" : "Chờ người chơi sẵn sàng"
                }
                className={styles.startBtn}
              />
            ) : (
              <Button
                onClick={handleToggleReady}
                children={localIsReady ? "Hủy sẵn sàng" : "Sẵn sàng"}
                className={styles.startBtn}
              />
            ))}
          <button className={styles.backButton} onClick={handleBackToMenu}>
            Leave
          </button>
          <div className={styles.roomTag}>Room: {roomId}</div>

          <Chat
            socket={socket}
            roomId={roomId}
            playerId={playerIdRef.current}
            started={currentPage === PAGES.GAME}
            meetingActive={meetingActive}
          />

          {meetingActive && meetingData && (
            <Meeting
              players={meetingData.players}
              currentPlayerId={playerIdRef.current}
              onVote={handleVoteCallBack}
              onEndMeeting={handleEndMeeting}
              timeRemaining={timeRemaining}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
