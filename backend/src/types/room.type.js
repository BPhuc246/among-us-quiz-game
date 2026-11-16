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
 *   isAlive: boolean
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
 *   votes: {[playerId: string]: string|null}
 * }} MeetingResults
 */

/**
 * @typedef {{
 *   isActive: boolean,
 *   callerId: string,
 *   votes: {[playerId: string]: string|null}, // playerId -> votedForId
 *   endTime: number,
 *   results?: MeetingResults
 * }} MeetingState
 */

/**
 * @typedef {{
 *   assignments: {questionId: string, stationId: string}[],
 *   revealed: number,
 *   completed: string[]
 * }} CrewTaskState
 */

/**
 * @typedef {{
 *   id: string,
 *   started: boolean,
 *   imposter: (string|null),
 *   host: Player,
 *   players: {[key: string]: Player},
 *   currentMeeting: MeetingState | null,
 *   questions: Question[],
 *   taskState?: {[playerId: string]: CrewTaskState},
 *   deadBodies?: {[playerId: string]: {playerId: string, x: number, y: number, color: string}}
 * }} GameRoom
 */

/**
 * @typedef {Omit<GameRoom, 'questions'> & {questions: PublicQuestion[]}} PublicGameRoom
 */

export {};
