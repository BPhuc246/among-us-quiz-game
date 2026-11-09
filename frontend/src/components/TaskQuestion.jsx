import { useEffect, useState } from "react";
import styles from "./TaskQuestion.module.css";

/**
 * question: { id, title, description, options: string[] }  (định dạng giống QuizTasks)
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
  const progressWidth = total ? `${(number / total) * 100}%` : "0%";

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
        <header className={styles.topbar}>
          <div className={styles.brandBlock}>
            <span className={styles.brandMark}>A</span>
            <div>
              <div className={styles.brand}>SKELD · TASK TERMINAL</div>
              <div className={styles.stationName}>
                {task?.taskName ?? `Trạm nhiệm vụ ${number}`}
              </div>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.questionCounter}>
              CÂU {String(number).padStart(2, "0")} /{" "}
              {String(total).padStart(2, "0")}
            </span>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Đóng cửa sổ"
            >
              ×
            </button>
          </div>
        </header>

        <form className={styles.body} onSubmit={handleSubmit}>
          <main className={styles.questionColumn}>
            <div className={styles.metaRow}>
              <span className={styles.typeBadge}>TRẮC NGHIỆM</span>
              <span className={styles.topic}>{question.title}</span>
            </div>

            <div className={styles.scrollArea}>
              <h1 id="task-question-title" className={styles.questionTitle}>
                {question.description || question.title}
              </h1>
              <p className={styles.instruction}>Chọn một đáp án đúng nhất.</p>

              <div className={styles.optionsGrid}>
                {options.map((label, index) => {
                  const isSelected = selected === index;
                  return (
                    <button
                      type="button"
                      key={index}
                      className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                      onClick={() => {
                        if (!correct && !pending) setSelected(index);
                      }}
                      aria-pressed={isSelected}
                      disabled={correct || pending}
                    >
                      <span className={styles.optionLetter}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className={styles.optionText}>
                        <strong>{label}</strong>
                      </span>
                      <span className={styles.radioMark}>
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              {wrong && (
                <div className={styles.feedbackWrong} role="alert">
                  <span>!</span>
                  <div>
                    <strong>Chưa chính xác</strong>
                    <p>
                      {result.message ||
                        "Hãy kiểm tra lại và thử thêm một lần nữa nhé."}
                    </p>
                  </div>
                </div>
              )}

              {correct && (
                <div className={styles.feedbackCorrect} role="status">
                  <span className={styles.successCheck}>✓</span>
                  <div>
                    <strong>Nhiệm vụ hoàn thành!</strong>
                    {result.explain && <p>{result.explain}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.questionFooter}>
              <span>AMONG US QUIZ · TRAINING SYSTEM</span>
              <span>01 lựa chọn</span>
            </div>
          </main>

          <aside className={styles.actionColumn}>
            <div className={styles.sideIcon}>
              {correct ? (
                <span className={styles.bigCheck}>✓</span>
              ) : (
                <div className={styles.taskDevice}>
                  <span className={styles.deviceScreen}>?</span>
                  <span className={styles.deviceLight} />
                </div>
              )}
            </div>
            <div className={styles.sideText}>
              <strong>{correct ? "ĐÃ XÁC NHẬN" : "XÁC NHẬN ĐÁP ÁN"}</strong>
              <p>
                {correct
                  ? "Dữ liệu đã được ghi nhận. Trạm nhiệm vụ đã hoàn tất."
                  : "Kiểm tra câu trả lời trước khi gửi lên hệ thống."}
              </p>
            </div>

            {correct ? (
              <button
                type="button"
                className={styles.submitButton}
                onClick={onClose}
              >
                HOÀN TẤT <span>✓</span>
              </button>
            ) : (
              <button
                type="submit"
                className={styles.submitButton}
                disabled={!canSubmit}
              >
                {pending ? "ĐANG KIỂM TRA…" : "SUBMIT"} <span>→</span>
              </button>
            )}

            <div className={styles.sideHint}>
              <span className={styles.keycap}>ENTER</span>
              <span>để gửi câu trả lời</span>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressLabel}>
                <span>TIẾN ĐỘ NHIỆM VỤ</span>
                <strong>
                  {number}/{total}
                </strong>
              </div>
              <div className={styles.progressTrack}>
                <span style={{ width: progressWidth }} />
              </div>
            </div>
          </aside>
        </form>
      </section>
    </div>
  );
}
