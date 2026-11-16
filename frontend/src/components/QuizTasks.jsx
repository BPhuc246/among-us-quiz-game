import { useCallback, useEffect, useRef, useState } from "react";
import { EventBus } from "../game/EventBus.js";
import { SKELD_TASK_LOCATIONS } from "../game/tasks/taskLocations.js";
import TaskQuestion from "./TaskQuestion";
import styles from "./QuizTasks.module.css";

const STATION_NAME = Object.fromEntries(
  SKELD_TASK_LOCATIONS.map((s) => [s.id, s.label]),
);

export default function QuizTasks({ socket, roomId, active }) {
  const [state, setState] = useState(null);
  const [nearbyStation, setNearbyStation] = useState(null);
  const [openTask, setOpenTask] = useState(null); // { stationId, questionId }
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(false);
  const [inMeeting, setInMeeting] = useState(false);
  const [notice, setNotice] = useState("");

  const stateRef = useRef(null);
  const visibleRef = useRef(false);
  const requestRef = useRef(0);

  const showTasks = Boolean(active && state && !inMeeting);

  const publishAssigned = useCallback(() => {
    const s = stateRef.current;
    const ids =
      visibleRef.current && s
        ? s.tasks.filter((t) => !t.completed).map((t) => t.stationId)
        : [];
    EventBus.emit("task:assigned", ids);
  }, []);

  const closeTask = useCallback(() => {
    requestRef.current += 1;
    setOpenTask(null);
    setResult(null);
    setPending(false);
    EventBus.emit("task:close");
  }, []);

  const openStation = useCallback((stationId) => {
    const s = stateRef.current;
    const task = s?.tasks.find((t) => t.stationId === stationId);

    if (!task) {
      console.warn("[QuizTasks] không có nhiệm vụ cho trạm", stationId);
      setNotice("Trạm này không nằm trong nhiệm vụ của bạn.");
      EventBus.emit("task:close");
      return;
    }
    if (task.completed) {
      setNotice("Nhiệm vụ ở trạm này đã hoàn thành.");
      EventBus.emit("task:close");
      return;
    }

    setNotice("");
    requestRef.current += 1;
    setResult(null);
    setPending(false);
    setOpenTask({ stationId, questionId: task.questionId });
    EventBus.emit("task:opened");
  }, []);

  // EventBus từ Phaser
  useEffect(() => {
    const onInteract = ({ stationId }) => openStation(stationId);
    const onNearby = (station) => setNearbyStation(station);
    const onCancel = () => closeTask();
    const onRequest = () => publishAssigned();

    EventBus.on("task:interact", onInteract);
    EventBus.on("task:nearby", onNearby);
    EventBus.on("quiz:cancel", onCancel);
    EventBus.on("task:request-assigned", onRequest);
    return () => {
      EventBus.off("task:interact", onInteract);
      EventBus.off("task:nearby", onNearby);
      EventBus.off("quiz:cancel", onCancel);
      EventBus.off("task:request-assigned", onRequest);
    };
  }, [openStation, closeTask, publishAssigned]);

  // Socket
  useEffect(() => {
    setState(null);
    setNearbyStation(null);
    if (!socket || !roomId) return;

    const onTasks = (data) => {
      if (data.roomId === roomId) setState(data);
    };
    const onProgress = (data) => {
      if (data.roomId === roomId) {
        setState((prev) =>
          prev
            ? {
                ...prev,
                progress: { completed: data.completed, total: data.total },
              }
            : prev,
        );
      }
    };
    const onMeeting = () => {
      setInMeeting(true);
      closeTask();
    };
    const onMeetingEnd = () => setInMeeting(false);

    socket.on("game:tasks", onTasks);
    socket.on("game:task-progress", onProgress);
    socket.on("meeting:started", onMeeting);
    socket.on("meeting:ended", onMeetingEnd);
    socket.on("game:ended", closeTask);
    socket.on("disconnect", closeTask);

    socket.emit("tasks:get", { roomId });

    return () => {
      socket.off("game:tasks", onTasks);
      socket.off("game:task-progress", onProgress);
      socket.off("meeting:started", onMeeting);
      socket.off("meeting:ended", onMeetingEnd);
      socket.off("game:ended", closeTask);
      socket.off("disconnect", closeTask);
      requestRef.current += 1;
    };
  }, [socket, roomId, closeTask]);

  // Đồng bộ ref và báo danh sách trạm cần highlight
  useEffect(() => {
    stateRef.current = state;
    visibleRef.current = showTasks;
    publishAssigned();
  }, [state, showTasks, publishAssigned]);

  useEffect(() => {
    if (!active) {
      closeTask();
      setInMeeting(false);
    }
  }, [active, closeTask]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  // Mọi hook ở trên. Từ đây trở xuống chỉ là logic render thuần.
  if (!showTasks) return null;

  const { tasks, progress } = state;
  const completedCount = tasks.filter((t) => t.completed).length;
  const percent = progress.total
    ? Math.round((100 * progress.completed) / progress.total)
    : 0;

  const openIndex = openTask
    ? tasks.findIndex((t) => t.stationId === openTask.stationId)
    : -1;
  const question = openTask
    ? state.questions.find((q) => q.id === openTask.questionId)
    : null;
  const connected = Boolean(socket?.connected);
  const canUse = Boolean(nearbyStation) && !openTask;

  const submit = (optionIndex) => {
    if (!openTask || pending || result?.correct || !socket) return;

    const { stationId, questionId } = openTask;
    setPending(true);
    setResult(null);
    const request = ++requestRef.current;

    socket
      .timeout(8000)
      .emit(
        "task:answer",
        { roomId, stationId, questionId, optionIndex },
        (error, response) => {
          if (request !== requestRef.current) return;
          setPending(false);
          if (error) {
            setResult({
              correct: false,
              message: "Chưa nhận được phản hồi. Bạn có thể gửi lại.",
            });
            return;
          }
          setResult(response);
          if (response?.correct) {
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    tasks: prev.tasks.map((t) =>
                      t.stationId === stationId ? { ...t, completed: true } : t,
                    ),
                  }
                : prev,
            );
          }
        },
      );
  };

  return (
    <>
      <aside className={styles.hud} aria-label="Nhiệm vụ học tập">
        <div className={styles.progressLabel}>
          <strong>TIẾN ĐỘ CẢ ĐỘI</strong>
          <span>
            {progress.completed}/{progress.total}
          </span>
        </div>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Tiến độ nhiệm vụ cả đội"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div style={{ width: `${percent}%` }} />
        </div>

        <h2>
          Nhiệm vụ của bạn{" "}
          <span>
            {completedCount}/{tasks.length}
          </span>
        </h2>
        <p className={styles.hint}>
          {nearbyStation
            ? `Nhấn E hoặc nút bên phải để làm ${nearbyStation.label}.`
            : "Di chuyển đến ô có viền vàng để làm nhiệm vụ."}
        </p>
        {notice && <p className={styles.hint}>{notice}</p>}

        <ul className={styles.taskList}>
          {tasks.map((t) => (
            <li key={t.stationId} className={t.completed ? styles.done : ""}>
              <span>{t.completed ? "✓" : "○"}</span>
              <span>{STATION_NAME[t.stationId] ?? t.stationId}</span>
            </li>
          ))}
        </ul>
      </aside>

      <button
        className={styles.useButton}
        disabled={!canUse}
        onClick={() => {
          if (canUse) openStation(nearbyStation.id);
        }}
      >
        LÀM NHIỆM VỤ <kbd>E</kbd>
      </button>

      {openTask && question && (
        <TaskQuestion
          task={{
            taskId: openTask.stationId,
            taskName: STATION_NAME[openTask.stationId],
          }}
          question={question}
          number={openIndex + 1}
          total={tasks.length}
          result={result}
          pending={pending}
          connected={connected}
          onSubmit={submit}
          onClose={closeTask}
        />
      )}

      {openTask && !question && (
        <div className={styles.backdrop}>
          <section className={styles.dialog} role="dialog" aria-modal="true">
            <h2>Chưa tải được câu hỏi</h2>
            <p className={styles.description}>
              Câu hỏi {openTask.questionId} không có trong dữ liệu từ máy chủ.
            </p>
            <div className={styles.actions}>
              <span />
              <button className={styles.submit} onClick={closeTask}>
                Đóng
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
