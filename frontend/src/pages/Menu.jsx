import { useState, useEffect, useRef } from "react";
import socketService from "../services/socket";
import styles from "./room.module.css";
import { apiUrl } from "../utils/urls.js";
import { Button } from "../components/Button.jsx";

// Phải khớp với MAX_PLAYERS_PER_ROOM ở backend/src/managers/rooms.manager.js
const MAX_PLAYERS_PER_ROOM = 6;
// Số phòng tối đa hiển thị trên một trang
const ROOMS_PER_PAGE = 4;

/**
 * @param {{onJoinGame: (roomId: string) => void}} props
 */
export function Menu({ onJoinGame }) {
  const [formData, setFormData] = useState({
    name: "",
    color: null,
    questions: "",
  });
  const [isRegistered, setIsRegistered] = useState(false);
  const isRegisteredRef = useRef(false);
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState({});

  const [questionFile, setQuestionFile] = useState(null);
  const [normalizing, setNormalizing] = useState(false);

  // Ô nhập đang gõ (chưa tìm) và kết quả tìm kiếm đã chốt khi nhấn Enter
  const [searchDraft, setSearchDraft] = useState("");
  const [searchResult, setSearchResult] = useState(null); // { term, ids } | null

  // Trang hiện tại của danh sách phòng (bắt đầu từ 1)
  const [page, setPage] = useState(1);

  const socket = socketService.getSocket();

  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) {
      setFormData((prev) => ({
        ...prev,
        name: savedName,
      }));
    }
  }, []);

  useEffect(() => {
    const onRoomCreated = (data) => {
      console.log("Room created (broadcast):", data);
      setRooms((prev) => ({ ...prev, [data.roomId]: data.room }));
    };

    const onRoomDeleted = (data) => {
      console.log("Room deleted (broadcast):", data);
      setRooms((prev) => {
        const updated = { ...prev };
        delete updated[data.roomId];
        return updated;
      });
    };

    // Server phát số người trong phòng mỗi khi có người vào/ra
    const onPlayerCount = ({ roomId, count }) => {
      setRooms((prev) => {
        if (!prev[roomId]) return prev;
        return { ...prev, [roomId]: { ...prev[roomId], playerCount: count } };
      });
    };

    const onRoomJoined = (data) => {
      console.log("Joined room:", data);
      const playerId = getPlayerId();
      onJoinGame({
        roomId: data.roomId,
        playerId,
        isHost: data.room.host.id === playerId,
      });
    };

    const onPlayerRegistered = () => {
      console.log("Player registered");
      isRegisteredRef.current = true;
      setIsRegistered(true);
    };

    const onPlayerUnregistered = () => {
      console.log("Player unregistered");
      isRegisteredRef.current = false;
      setIsRegistered(false);
    };

    const handleCantJoin = (data) => {
      setError(data.message || "Cannot join room");
    };

    socket.on("room:created", onRoomCreated);
    socket.on("room:deleted", onRoomDeleted);
    socket.on("room:player-count", onPlayerCount);
    socket.on("room:joined", onRoomJoined);
    socket.on("player:registered", onPlayerRegistered);
    socket.on("player:unregistered", onPlayerUnregistered);
    socket.on("room:join:error", handleCantJoin);

    fetchRooms()
      .then(setRooms)
      .catch((error) => console.error("Error fetching rooms:", error));

    return () => {
      socket.off("room:created", onRoomCreated);
      socket.off("room:deleted", onRoomDeleted);
      socket.off("room:player-count", onPlayerCount);
      socket.off("room:joined", onRoomJoined);
      socket.off("player:registered", onPlayerRegistered);
      socket.off("player:unregistered", onPlayerUnregistered);
      socket.off("room:join:error", handleCantJoin);
    };
  }, [socket, onJoinGame]);

  const handleRegister = () => {
    if (!formData.name.trim()) {
      setError("Please enter a name");
      return;
    }

    if (!socket.id) {
      setError("Not connected to server");
      return;
    }
    const playerId = getPlayerId();

    localStorage.setItem("playerName", formData.name.trim());

    // Use selected color or random color if none selected
    const playerColor = formData.color || getRandomColor();
    console.log(
      "Registering player with color:",
      playerColor,
      "Selected:",
      formData.color,
    );

    socket.emit("player:register", {
      id: playerId,
      name: formData.name.trim(),
      color: playerColor,
    });

    setError("");
  };

  const handleBackToRegister = () => {
    const playerId = getPlayerId();
    socket.emit("player:unregister", { playerId });
  };

  // Đọc file thành chuỗi base64 để gửi kèm trong JSON
  const readAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Gửi văn bản / file lên backend để AI chuẩn hóa, rồi ghi JSON vào ô câu hỏi
  const handleNormalize = async () => {
    setNormalizing(true);
    setError("");
    try {
      const file = questionFile
        ? { name: questionFile.name, data: await readAsBase64(questionFile) }
        : null;
      const res = await fetch(apiUrl("/normalize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formData.questions, file }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFormData((prev) => ({
        ...prev,
        questions: JSON.stringify(data, null, 2),
      }));
    } catch (err) {
      setError("AI lỗi: " + err.message);
    } finally {
      setNormalizing(false);
    }
  };

  // Chỉ tìm khi nhấn Enter (bỏ qua lúc đang gõ tiếng Việt có dấu)
  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const term = searchDraft.trim();
    if (!term) {
      setSearchResult(null);
      setPage(1);
      return;
    }
    const upper = term.toUpperCase();
    const ids = Object.keys(rooms).filter((id) =>
      id.toUpperCase().includes(upper),
    );
    setSearchResult({ term, ids });
    setPage(1);
  };

  const clearSearch = () => {
    setSearchResult(null);
    setSearchDraft("");
    setPage(1);
  };

  // Khi đang có kết quả tìm kiếm thì chỉ hiện các phòng đã khớp, còn không thì hiện tất cả
  const visibleRooms = searchResult
    ? searchResult.ids.map((id) => rooms[id]).filter(Boolean)
    : Object.values(rooms);

  // Phân trang: cắt danh sách theo trang, và giữ trang hợp lệ khi số phòng thay đổi
  const totalPages = Math.max(
    1,
    Math.ceil(visibleRooms.length / ROOMS_PER_PAGE),
  );
  const currentPage = Math.min(page, totalPages);
  const pageRooms = visibleRooms.slice(
    (currentPage - 1) * ROOMS_PER_PAGE,
    currentPage * ROOMS_PER_PAGE,
  );
  const goPrev = () => setPage(Math.max(1, currentPage - 1));
  const goNext = () => setPage(Math.min(totalPages, currentPage + 1));

  const handleCreateRoom = () => {
    if (!isRegisteredRef.current) {
      setError("Please register first");
      return;
    }

    /** @type {unknown} */
    let questions;
    try {
      questions = JSON.parse(formData.questions);
    } catch (err) {
      setError("Questions không phải JSON hợp lệ: " + err.message);
      return;
    }

    if (!Array.isArray(questions) || questions.length < 2) {
      setError("Cần ít nhất 2 câu hỏi (dạng mảng JSON)");
      return;
    }

    const newRoomId = generateRoomId();
    const playerId = getPlayerId();
    console.log("Questions gửi lên:", questions);

    socket.emit("room:create", {
      hostId: playerId,
      roomId: newRoomId,
      questions,
    });
  };

  const handleJoinRoom = (roomId) => {
    if (!isRegisteredRef.current) {
      setError("Please register first");
      return;
    }
    console.log("Joining room:", roomId);
    fetch(apiUrl(`/rooms/${roomId}`))
      .then((response) => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        console.log(data);
        if (data?.players) {
          const alreadyIn = Boolean(data.players[getPlayerId()]);
          if (
            !alreadyIn &&
            Object.keys(data.players).length >= MAX_PLAYERS_PER_ROOM
          ) {
            setError(
              `Phòng đã đầy (${MAX_PLAYERS_PER_ROOM}/${MAX_PLAYERS_PER_ROOM} người)`,
            );
            return;
          }
          const taken_colors = Object.values(data.players).map((p) => p.color);
          const taken_names = Object.values(data.players).map((p) => p.name);
          if (taken_names.includes(formData.name)) {
            setError("Name already taken in this room");
            return;
          }
          if (formData.color && taken_colors.includes(formData.color)) {
            setError("Color already taken in this room");
            return;
          }
        }
        const playerId = getPlayerId();
        socket.emit("room:join", {
          playerId: playerId,
          roomId: roomId,
        });
      })
      .catch((error) => {
        console.error("Error fetching room data:", error);
        setError("Could not join room — is the server running?");
      });
  };

  return (
    <div className={styles.container}>
      {isRegistered && (
        <Button
          onClick={handleBackToRegister}
          children="Back"
          className={styles.backBtn}
        />
      )}
      <div className={styles.card}>
        <h1 className={styles.title}>Quiz Crew</h1>
        {!isRegistered ? (
          <div className={styles.section}>
            <div className={styles.registrationLayout}>
              {/* LEFT COLUMN: Player information */}
              <div className={styles.leftColumn}>
                <h2 className={styles.subtitle}>Enter Your Name</h2>
                <input
                  type="text"
                  placeholder="Your name..."
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className={styles.input}
                  maxLength={20}
                />

                <div className={styles.colorPickerSection}>
                  <p className={styles.colorLabel}>
                    Choose your color (optional):
                  </p>

                  <div className={styles.colorGrid}>
                    {getAvailableColors().map((color) => (
                      <div
                        key={color}
                        className={`${styles.colorOption} ${
                          formData.color === color
                            ? styles.colorOptionSelected
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            color: color,
                          }))
                        }
                        title={color}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        color: null,
                      }))
                    }
                    className={styles.clearColorButton}
                  >
                    Clear Selection (Random)
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Questions JSON */}
              <div className={styles.rightColumn}>
                <p className={styles.colorLabel}>Add Questions (JSON)</p>

                <textarea
                  className={styles.questions}
                  placeholder={`[
  {
    "title": "Hành tinh nào được gọi là Hành tinh Đỏ?",
    "description": "Chọn đáp án đúng.",
    "options": ["Trái Đất", "Sao Hỏa", "Sao Kim", "Sao Mộc"],
    "answer": "Sao Hỏa",
    "explain": "Sao Hỏa có bề mặt chứa nhiều oxit sắt."
  }
]`}
                  value={formData.questions}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      questions: e.target.value,
                    }))
                  }
                />
                <input
                  type="file"
                  accept=".txt,.csv,.md,.docx,.pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setQuestionFile(e.target.files[0] ?? null)}
                />
                <button
                  type="button"
                  className={styles.clearColorButton}
                  onClick={handleNormalize}
                  disabled={normalizing}
                >
                  {normalizing ? "AI đang xử lý..." : "✨ AI chuẩn hóa"}
                </button>
              </div>
            </div>

            <Button onClick={handleRegister} children="Continue" />
          </div>
        ) : (
          <div className={styles.section}>
            <p className={styles.welcome}>Chào mừng, {formData.name}!</p>

            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Nhập mã phòng rồi nhấn Enter..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className={styles.input}
              />
              {searchResult && (
                <button
                  type="button"
                  className={styles.clearColorButton}
                  onClick={clearSearch}
                >
                  Xóa tìm kiếm
                </button>
              )}
            </div>

            <div>
              {visibleRooms.length > 0 ? (
                <div>
                  <div className={styles.roomGrid}>
                    {pageRooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        onJoin={handleJoinRoom}
                      />
                    ))}
                  </div>

                  {visibleRooms.length > ROOMS_PER_PAGE && (
                    <div className={styles.pagination}>
                      <button
                        type="button"
                        className={styles.pageButton}
                        onClick={goPrev}
                        disabled={currentPage === 1}
                      >
                        ← Trước
                      </button>
                      <span className={styles.pageInfo}>
                        Trang {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className={styles.pageButton}
                        onClick={goNext}
                        disabled={currentPage === totalPages}
                      >
                        Sau →
                      </button>
                    </div>
                  )}
                </div>
              ) : searchResult ? (
                <RoomNotFound term={searchResult.term} />
              ) : (
                <p className={styles.noRooms}>
                  Hiện không có phòng
                </p>
              )}
            </div>
            <Button onClick={handleCreateRoom} children="Create Room" />
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

/**
 * Thẻ một phòng trong lưới: mã phòng, trạng thái, host, số người và thanh tiến độ.
 * @param {{room: any, onJoin: (roomId: string) => void}} props
 */
function RoomCard({ room, onJoin }) {
  const count = getRoomCount(room);
  const full = count >= MAX_PLAYERS_PER_ROOM;
  const color = full ? "#ff4d4f" : "#4caf50";
  const percent = Math.min(100, (count / MAX_PLAYERS_PER_ROOM) * 100);

  return (
    <button
      type="button"
      className={`${styles.roomCard} ${full ? styles.roomCardFull : ""}`}
      onClick={() => onJoin(room.id)}
      disabled={full}
    >
      <div className={styles.roomCardHeader}>
        <span className={styles.roomCardCode}>{room.id}</span>
        <span
          className={styles.roomCardBadge}
          style={{ color, borderColor: color }}
        >
          {full ? "Đầy" : "Còn chỗ"}
        </span>
      </div>

      <div className={styles.roomCardHost}>
        Chủ phòng: <strong>{room.host?.name ?? "?"}</strong>
      </div>

      <div className={styles.roomCardCount}>
        <span style={{ color, fontWeight: "bold" }}>
          {count}/{MAX_PLAYERS_PER_ROOM}
        </span>{" "}
        người chơi
      </div>

      <div className={styles.roomCardBar}>
        <div
          className={styles.roomCardFill}
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </button>
  );
}

/**
 * Backend returns an array of rooms; UI stores them keyed by id.
 * @param {unknown} data
 * @returns {Record<string, object>}
 */
function roomsToMap(data) {
  if (Array.isArray(data)) {
    return Object.fromEntries(data.map((room) => [room.id, room]));
  }
  if (data && typeof data === "object") {
    return data;
  }
  return {};
}

async function fetchRooms() {
  const response = await fetch(apiUrl("/rooms"));
  if (!response.ok) {
    throw new Error(`Failed to fetch rooms: ${response.status}`);
  }
  const data = await response.json();
  return roomsToMap(data);
}

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateUserId() {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const getPlayerId = () => {
  const playerId = sessionStorage.getItem("playerId");
  if (!playerId) {
    const id = generateUserId();
    sessionStorage.setItem("playerId", id);
    return id;
  }
  return playerId;
};

/**
 * Available Among Us colors
 */
const PLAYER_COLORS = [
  "#c51111", // red
  "#132ed1", // blue
  "#117f2d", // green
  "#ed54ba", // pink
  "#ef7d0d", // orange
  "#f5f557", // yellow
  "#3f474e", // black
  "#d6e0f0", // white
  "#6b2fbc", // purple
  "#71491e", // brown
  "#38fedc", // cyan
  "#50ef39", // lime
];

function getRandomColor() {
  return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

function getAvailableColors() {
  return PLAYER_COLORS;
}

/**
 * Số người trong phòng: ưu tiên số do server phát realtime, sau đó mới tới danh sách players.
 * @param {{playerCount?: number, players?: Record<string, unknown>}} room
 * @returns {number}
 */
function getRoomCount(room) {
  return room.playerCount ?? Object.keys(room.players ?? {}).length;
}

/**
 * Hiển thị khi tìm kiếm không có phòng nào khớp.
 * @param {{term: string}} props
 */
function RoomNotFound({ term }) {
  return (
    <div className={styles.noRooms}>
      <h3 className={styles.subtitle}>Not found</h3>
      <p>Không tìm thấy phòng nào khớp với "{term}".</p>
    </div>
  );
}

export default Menu;
