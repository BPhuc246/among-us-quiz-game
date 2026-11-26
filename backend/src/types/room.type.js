// backend/src/types/room.type.js

/**
 * @typedef {{x:number, y:number, d:string, moving:boolean}} PlayerState
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   roomId: string|null,
 *   state: PlayerState,
 *   color: string,
 *   isImposter: boolean,
 *   isAlive: boolean,
 *   isReady: boolean,
 * }} Player
 */

/**
 * Câu hỏi frontend gửi khi tạo phòng (chưa có id, roomId).
 * @typedef {{
 *   title: string,
 *   description?: string,
 *   options: string[] | number[],
 *   answer: string | number,
 *   explain: string
 * }} QuestionInput
 */

/**
 * Câu hỏi backend lưu trong room, do server gán id và roomId.
 * @typedef {{
 *   id: string,
 *   roomId: string,
 *   title: string,
 *   description: string,
 *   options: string[] | number[],
 *   answer: string | number,
 *   explain: string
 * }} Question
 */

/**
 * Câu hỏi gửi tới client: không có đáp án và lời giải.
 * @typedef {Omit<Question, 'answer' | 'explain'>} PublicQuestion
 */

/**
 * @typedef {{
 *   ejectedId: string|null,
 *   tie: boolean,
 *   counts: {[playerId: string]: number},
 *   votes: {[playerId: string]: string|null},
 *   ejectedPlayer?: {id: string, name: string, color: string, isImposter: boolean}
 * }} MeetingResults
 */

/**
 * @typedef {{
 *   isActive: boolean,
 *   callerId: string,
 *   votes: {[playerId: string]: string|null},
 *   endTime: number,
 *   results?: MeetingResults
 * }} MeetingState
 */

/**
 * Trạng thái nhiệm vụ của một người chơi trong ván.
 * - batch: đợt nhiệm vụ hiện tại (tối đa 6, không trùng câu trong đợt)
 * - revealed: số nhiệm vụ đang mở, tính theo thứ tự trong batch
 * - completed: id câu đã làm xong trong đợt hiện tại
 * - lifetimeDone: tổng số câu đã làm từ đầu ván (dùng để tính lượt giết của imposter)
 * - roundDone: số câu đã làm từ lần vote gần nhất (dùng để tính tiến độ crew)
 * - killsUsed: số lượt giết đã dùng (chỉ imposter)
 * @typedef {{
 *   batch: {questionId: string, stationId: string}[],
 *   revealed: number,
 *   completed: string[],
 *   lifetimeDone: number,
 *   roundDone: number,
 *   killsUsed: number
 * }} PlayerTaskState
 */

/**
 * Thông tin tiến độ chung của phòng.
 * - shownCompleted: tiến độ đang hiển thị, chỉ đổi sau mỗi lần vote
 * - prevImposterRoundDone: số câu imposter đã làm ở đợt họp trước, dùng để trừ tiến độ crew
 * @typedef {{
 *   shownCompleted: number,
 *   prevImposterRoundDone: number
 * }} TaskMeta
 */

/**
 * @typedef {{
 *   id: string,
 *   started: boolean,
 *   eliminationInProgress?: boolean,
 *   imposter: (string|null),
 *   host: Player,
 *   players: {[key: string]: Player},
 *   currentMeeting: MeetingState | null,
 *   questions: Question[],
 *   taskState?: {[playerId: string]: PlayerTaskState},
 *   taskMeta?: TaskMeta,
 *   deadBodies?: {[playerId: string]: {playerId: string, x: number, y: number, color: string}}
 * }} GameRoom
 */

/**
 * Room gửi cho client: bỏ câu hỏi có đáp án, bỏ nhiệm vụ và bỏ taskMeta
 * (taskMeta chứa số câu của imposter nên có thể làm lộ danh tính).
 * @typedef {Omit<GameRoom, 'questions' | 'taskState' | 'taskMeta'> & {questions: PublicQuestion[]}} PublicGameRoom
 */

export {};
