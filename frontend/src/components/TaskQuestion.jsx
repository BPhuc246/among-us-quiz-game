import { useEffect, useState } from "react";
import styles from "./TaskQuestion.module.css";

const LETTERS = "ABCDEFGH";

/**
 * question: { id, title, description, options }
 * result:   { correct, message?, explain? } từ server, hoặc null
 */
export default function TaskQuestion({
  task,
  question,
  number,
  total,
  result,
  pending,
  connected,
  onSubmit,
  onClose,
}) {
  const [selected, setSelected] = useState(null);

  const questionId = question?.id;

  useEffect(() => {
    setSelected(null);
  }, [questionId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Guard phải đặt sau mọi hook để không vi phạm thứ tự hook của React
  if (!question) {
    console.warn("[TaskQuestion] Thiếu prop question", { task, number, total });
    return null;
  }

  const correct = Boolean(result?.correct);
  const wrong = Boolean(result) && !correct;
  const options = (question.options ?? []).map((text) => String(text));
  const canSubmit = !correct && !pending && connected && selected !== null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (canSubmit) onSubmit(selected);
  };

  const handleBackdrop = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onMouseDown={handleBackdrop}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-question-title"
      >
        <header className={styles.header}>
          <span className={styles.station}>
            {task?.taskName ?? "Trạm nhiệm vụ"}
          </span>
          <span className={styles.counter}>
            {number}/{total}
          </span>
        </header>

        <form className={styles.body} onSubmit={handleSubmit}>
          <p className={styles.topic}>{question.title}</p>
          <h1 id="task-question-title" className={styles.title}>
            {question.description || question.title}
          </h1>

          <div className={styles.options}>
            {options.map((label, index) => {
              const isSelected = selected === index;
              return (
                <button
                  type="button"
                  key={index}
                  className={`${styles.option} ${isSelected ? styles.selected : ""}`}
                  onClick={() => {
                    if (!correct && !pending) setSelected(index);
                  }}
                  aria-pressed={isSelected}
                  disabled={correct || pending}
                >
                  <span className={styles.letter}>{LETTERS[index]}</span>
                  <span className={styles.label}>{label}</span>
                </button>
              );
            })}
          </div>

          {wrong && (
            <p className={styles.wrong} role="alert">
              {result.message || "Chưa chính xác. Hãy thử lại."}
            </p>
          )}

          {correct && (
            <p className={styles.right} role="status">
              ✓ {result.explain || "Nhiệm vụ hoàn thành!"}
            </p>
          )}

          <footer className={styles.footer}>
            <span className={styles.hint}>
              {correct
                ? "Nhấn ĐÓNG ở góc dưới bên phải để tiếp tục"
                : "Chọn một đáp án rồi nhấn Enter hoặc GỬI"}
            </span>
            {!correct && (
              <button
                type="submit"
                className={styles.submit}
                disabled={!canSubmit}
              >
                {pending ? "Đang kiểm tra…" : "GỬI"}
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
