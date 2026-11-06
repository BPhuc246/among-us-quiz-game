import { useCallback, useEffect, useRef, useState } from "react";
import { EventBus } from "../game/EventBus.js";
import styles from "./QuizTasks.module.css";

export default function QuizTasks({ socket, roomId, active }) {
    const [state, setState] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [nearby, setNearby] = useState(null);
    const [taskId, setTaskId] = useState(null);
    const [selected, setSelected] = useState(null);
    const [result, setResult] = useState(null);
    const [pending, setPending] = useState(false);
    const [inMeeting, setInMeeting] = useState(false);
    const dialogRef = useRef(null);
    const requestRef = useRef(0);
    const submitLock = useRef(false);

    const closeQuiz = useCallback(() => {
        requestRef.current += 1;
        submitLock.current = false;
        setTaskId(null);
        setPending(false);
        EventBus.emit("quiz:close");
    }, []);

    useEffect(() => {
        setState(null);
        setQuestions([]);
        setNearby(null);
        if (!socket || !roomId) return;
        const onQuestions = (data) => {
            if (data.roomId === roomId) setQuestions(data.questions);
        };
        const onTasks = (data) => {
            if (data.roomId !== roomId) return;
            setState(data);
            setQuestions(data.questions);
        };
        const onProgress = (data) => {
            if (data.roomId === roomId) setState((prev) => prev ? { ...prev, progress: data } : prev);
        };
        const onOpen = (id) => {
            requestRef.current += 1;
            submitLock.current = false;
            setSelected(null);
            setResult(null);
            setPending(false);
            setTaskId(id);
        };
        const onMeeting = () => { setInMeeting(true); closeQuiz(); };
        const onMeetingEnd = () => setInMeeting(false);
        socket.on("game:questions", onQuestions);
        socket.on("game:tasks", onTasks);
        socket.on("game:task-progress", onProgress);
        socket.on("meeting:started", onMeeting);
        socket.on("meeting:ended", onMeetingEnd);
        socket.on("game:ended", closeQuiz);
        socket.on("disconnect", closeQuiz);
        EventBus.on("quiz:open", onOpen);
        EventBus.on("quiz:nearby", setNearby);
        EventBus.on("quiz:cancel", closeQuiz);
        return () => {
            socket.off("game:questions", onQuestions);
            socket.off("game:tasks", onTasks);
            socket.off("game:task-progress", onProgress);
            socket.off("meeting:started", onMeeting);
            socket.off("meeting:ended", onMeetingEnd);
            socket.off("game:ended", closeQuiz);
            socket.off("disconnect", closeQuiz);
            EventBus.off("quiz:open", onOpen);
            EventBus.off("quiz:nearby", setNearby);
            EventBus.off("quiz:cancel", closeQuiz);
            requestRef.current += 1;
        };
    }, [socket, roomId, closeQuiz]);

    useEffect(() => {
        if (!active) { closeQuiz(); setInMeeting(false); }
    }, [active, closeQuiz]);

    useEffect(() => {
        if (!taskId) return;
        const previousFocus = document.activeElement;
        dialogRef.current?.focus();
        const onKey = (event) => {
            if (event.key === "Escape") closeQuiz();
            if (event.key !== "Tab") return;
            const buttons = [...(dialogRef.current?.querySelectorAll("button:not(:disabled)") || [])];
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
                event.preventDefault(); last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
                event.preventDefault(); first?.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
    }, [taskId, closeQuiz]);

    if (!active || !state || inMeeting) return null;
    const { tasks, progress, isImposter } = state;
    const task = tasks.find((item) => item.id === taskId);
    const question = questions.find((item) => item.id === taskId);
    const completed = tasks.filter((item) => item.completed).length;
    const percent = progress.total ? Math.round(100 * progress.completed / progress.total) : 0;
    const canUse = nearby?.canUse && !inMeeting && !taskId;

    const submit = () => {
        if (selected === null || submitLock.current || result?.correct) return;
        submitLock.current = true;
        setPending(true);
        setResult(null);
        const request = ++requestRef.current;
        socket.timeout(8000).emit("task:answer", { roomId, taskId, optionIndex: selected }, (error, response) => {
            if (request !== requestRef.current) return;
            submitLock.current = false;
            setPending(false);
            setResult(error ? { ok: false, message: "Chưa nhận được phản hồi. Bạn có thể gửi lại." } : response);
        });
    };

    return <>
        <aside className={styles.hud} aria-label="Nhiệm vụ học tập">
            <div className={styles.progressLabel}><strong>TIẾN ĐỘ CẢ ĐỘI</strong><span>{progress.completed}/{progress.total}</span></div>
            <div className={styles.progress} role="progressbar" aria-label="Tiến độ nhiệm vụ cả đội" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div style={{ width: `${percent}%` }} /></div>
            {isImposter ? <p className={styles.hint}>Bạn là Impostor. Crewmate đang làm nhiệm vụ câu hỏi.</p> : <>
                <h2>Nhiệm vụ của bạn <span>{completed}/{tasks.length}</span></h2>
                <p className={styles.hint}>{nearby?.isGhost ? "Bạn vẫn có thể làm bài để giúp cả đội." : "Di chuyển bằng W A S D đến dấu ? màu vàng."}</p>
                <ul className={styles.taskList}>{tasks.map((item, index) => <li key={item.id} className={item.completed ? styles.done : ""}>
                    <span>{item.completed ? "✓" : "○"}</span><span>{item.station.name} · Câu {index + 1}</span>
                </li>)}</ul>
            </>}
        </aside>
        {!isImposter && <button className={styles.useButton} disabled={!canUse} onClick={() => EventBus.emit("quiz:use")}>
            LÀM NHIỆM VỤ <kbd>E</kbd>
        </button>}
        {task && question && !inMeeting && <div className={styles.backdrop}>
            <section ref={dialogRef} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="quiz-title" aria-describedby="quiz-description">
                <div className={styles.dialogTop}><span>{task.station.name} · Câu {tasks.indexOf(task) + 1}/{tasks.length}</span><button aria-label="Đóng câu hỏi" onClick={closeQuiz}>✕</button></div>
                <p className={styles.eyebrow}>NHIỆM VỤ HỌC TẬP</p>
                <h2 id="quiz-title">{question.title}</h2>
                <p id="quiz-description" className={styles.description}>{question.description}</p>
                <div className={styles.options}>{question.options.map((option, index) => <button key={index}
                    className={`${styles.option} ${selected === index ? styles.selected : ""}`}
                    aria-pressed={selected === index} disabled={pending || result?.correct}
                    onClick={() => { setSelected(index); setResult(null); }}>
                    <span>{String.fromCharCode(65 + index)}</span>{String(option)}
                </button>)}</div>
                {result && <div role="status" className={`${styles.feedback} ${result.correct ? styles.correct : styles.incorrect}`}>
                    <strong>{result.message || "Nhiệm vụ đã hoàn thành."}</strong>
                    {result.correct && result.explain && <p>{result.explain}</p>}
                </div>}
                <div className={styles.actions}><span>Bạn vẫn có thể bị Impostor tấn công khi làm bài.</span>
                    {result?.correct ? <button className={styles.submit} onClick={closeQuiz}>Hoàn thành ✓</button> : <button className={styles.submit} disabled={selected === null || pending || !socket?.connected} onClick={submit}>{pending ? "Đang kiểm tra…" : "Trả lời"}</button>}
                </div>
            </section>
        </div>}
    </>;
}
