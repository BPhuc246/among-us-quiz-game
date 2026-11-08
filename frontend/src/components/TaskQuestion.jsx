import { useEffect, useMemo, useState } from 'react';
import styles from './TaskQuestion.module.css';
import { getTaskQuestion } from '../game/tasks/taskQuestions.js';

function normalizeAnswer(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('vi')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function TaskQuestion({ task, onClose, onComplete }) {
    const question = useMemo(() => getTaskQuestion(task?.taskId), [task?.taskId]);
    const [selectedOption, setSelectedOption] = useState('');
    const [typedAnswer, setTypedAnswer] = useState('');
    const [status, setStatus] = useState('idle'); // idle | wrong | correct

    useEffect(() => {
        setSelectedOption('');
        setTypedAnswer('');
        setStatus('idle');
    }, [task?.taskId]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!question) {
        return (
            <div className={styles.overlay} role="presentation">
                <section className={styles.modal} role="dialog" aria-modal="true">
                    <div className={styles.topbar}>
                        <span className={styles.brand}>SKELD · TASK TERMINAL</span>
                        <button className={styles.closeButton} onClick={onClose} aria-label="Đóng">×</button>
                    </div>
                    <div className={styles.emptyState}>
                        <h2>Chưa có câu hỏi cho trạm này</h2>
                        <p>Không tìm thấy dữ liệu câu hỏi tương ứng với {task?.taskId}.</p>
                        <button className={styles.primaryButton} onClick={onClose}>Đóng</button>
                    </div>
                </section>
            </div>
        );
    }

    const isMultipleChoice = question.type === 'multiple-choice';
    const canSubmit = status !== 'correct' && (
        isMultipleChoice ? Boolean(selectedOption) : Boolean(typedAnswer.trim())
    );

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!canSubmit) return;

        const submitted = isMultipleChoice ? selectedOption : typedAnswer;
        const accepted = question.acceptedAnswers ?? [question.answer];
        const isCorrect = accepted.some(
            (answer) => normalizeAnswer(answer) === normalizeAnswer(submitted)
        );

        if (isCorrect) {
            setStatus('correct');
            onComplete(task.taskId);
        } else {
            setStatus('wrong');
        }
    };

    const handleBackdrop = (event) => {
        if (event.target === event.currentTarget) onClose();
    };

    return (
        <div className={styles.overlay} onMouseDown={handleBackdrop}>
            <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="task-question-title">
                <header className={styles.topbar}>
                    <div className={styles.brandBlock}>
                        <span className={styles.brandMark}>A</span>
                        <div>
                            <div className={styles.brand}>SKELD · TASK TERMINAL</div>
                            <div className={styles.stationName}>{task?.taskName ?? `Trạm nhiệm vụ ${question.number}`}</div>
                        </div>
                    </div>
                    <div className={styles.topbarRight}>
                        <span className={styles.questionCounter}>CÂU {String(question.number).padStart(2, '0')} / 05</span>
                        <button className={styles.closeButton} onClick={onClose} aria-label="Đóng cửa sổ">×</button>
                    </div>
                </header>

                <form className={styles.body} onSubmit={handleSubmit}>
                    <main className={styles.questionColumn}>
                        <div className={styles.metaRow}>
                            <span className={styles.typeBadge}>{question.typeLabel}</span>
                            <span className={styles.topic}>{question.title}</span>
                        </div>

                        <div className={styles.scrollArea}>
                            <h1 id="task-question-title" className={styles.questionTitle}>{question.question}</h1>
                            <p className={styles.instruction}>
                                {isMultipleChoice
                                    ? 'Chọn một đáp án đúng nhất.'
                                    : 'Nhập câu trả lời vào ô bên dưới.'}
                            </p>

                            {isMultipleChoice ? (
                                <div className={styles.optionsGrid}>
                                    {question.options.map((option, index) => {
                                        const selected = selectedOption === option.value;
                                        return (
                                            <button
                                                type="button"
                                                key={option.value}
                                                className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
                                                onClick={() => {
                                                    if (status !== 'correct') {
                                                        setSelectedOption(option.value);
                                                        setStatus('idle');
                                                    }
                                                }}
                                                aria-pressed={selected}
                                                disabled={status === 'correct'}
                                            >
                                                <span className={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
                                                <span className={styles.optionText}>
                                                    <strong>{option.label}</strong>
                                                    <small>{option.hint}</small>
                                                </span>
                                                <span className={styles.radioMark}>{selected ? '✓' : ''}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className={styles.answerField}>
                                    <label htmlFor="task-answer">Câu trả lời của bạn</label>
                                    <input
                                        id="task-answer"
                                        type="text"
                                        value={typedAnswer}
                                        onChange={(event) => {
                                            setTypedAnswer(event.target.value);
                                            setStatus('idle');
                                        }}
                                        placeholder={question.placeholder}
                                        autoComplete="off"
                                        spellCheck="false"
                                        disabled={status === 'correct'}
                                        autoFocus
                                    />
                                </div>
                            )}

                            {status === 'wrong' && (
                                <div className={styles.feedbackWrong} role="alert">
                                    <span>!</span>
                                    <div>
                                        <strong>Chưa chính xác</strong>
                                        <p>Hãy kiểm tra lại và thử thêm một lần nữa nhé.</p>
                                    </div>
                                </div>
                            )}

                            {status === 'correct' && (
                                <div className={styles.feedbackCorrect} role="status">
                                    <span className={styles.successCheck}>✓</span>
                                    <div>
                                        <strong>Nhiệm vụ hoàn thành!</strong>
                                        <p>{question.explanation}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.questionFooter}>
                            <span>AMONG US QUIZ · TRAINING SYSTEM</span>
                            <span>{isMultipleChoice ? '01 lựa chọn' : '01 câu trả lời'}</span>
                        </div>
                    </main>

                    <aside className={styles.actionColumn}>
                        <div className={styles.sideIcon}>
                            {status === 'correct' ? (
                                <span className={styles.bigCheck}>✓</span>
                            ) : (
                                <div className={styles.taskDevice}>
                                    <span className={styles.deviceScreen}>?</span>
                                    <span className={styles.deviceLight} />
                                </div>
                            )}
                        </div>
                        <div className={styles.sideText}>
                            <strong>{status === 'correct' ? 'ĐÃ XÁC NHẬN' : 'XÁC NHẬN ĐÁP ÁN'}</strong>
                            <p>
                                {status === 'correct'
                                    ? 'Dữ liệu đã được ghi nhận. Trạm nhiệm vụ đã hoàn tất.'
                                    : 'Kiểm tra câu trả lời trước khi gửi lên hệ thống.'}
                            </p>
                        </div>
                        {status === 'correct' ? (
                            <button type="button" className={styles.submitButton} onClick={onClose}>
                                HOÀN TẤT <span>✓</span>
                            </button>
                        ) : (
                            <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
                                SUBMIT <span>→</span>
                            </button>
                        )}
                        <div className={styles.sideHint}>
                            <span className={styles.keycap}>ENTER</span>
                            <span>để gửi câu trả lời</span>
                        </div>
                        <div className={styles.progress}>
                            <div className={styles.progressLabel}>
                                <span>TIẾN ĐỘ NHIỆM VỤ</span>
                                <strong>{question.number}/5</strong>
                            </div>
                            <div className={styles.progressTrack}>
                                <span style={{ width: `${question.number * 20}%` }} />
                            </div>
                        </div>
                    </aside>
                </form>
            </section>
        </div>
    );
}

export default TaskQuestion;
