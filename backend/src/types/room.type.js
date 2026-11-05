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
 * Question gửi tới client, đã loại bỏ đáp án.
 * @typedef {Omit<Question, 'answer'>} PublicQuestion
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
 *   id: string,
 *   started: boolean,
 *   imposter: (string|null),
 *   host: Player,
 *   players: {[key: string]: Player},
 *   currentMeeting: MeetingState | null,
 *   questions: Question[],
 *   taskCompletions?: {[playerId: string]: string[]},
 *   taskAssignments?: {[playerId: string]: string[]},
 *   deadBodies?: {[playerId: string]: {playerId: string, x: number, y: number, color: string}}
 * }} GameRoom
 */

/**
 * @typedef {Omit<GameRoom, 'questions'> & {questions: PublicQuestion[]}} PublicGameRoom
 */

export {};
