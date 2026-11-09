/**
 * Chuyển câu hỏi nội bộ thành dạng gửi cho client: bỏ answer và explain.
 * @param {import('../types/room.type.js').Question} q
 * @returns {import('../types/room.type.js').PublicQuestion}
 */
export const toPublicQuestion = ({
    id,
    roomId,
    title,
    description,
    options,
}) => ({
    id,
    roomId,
    title,
    description,
    options,
});
