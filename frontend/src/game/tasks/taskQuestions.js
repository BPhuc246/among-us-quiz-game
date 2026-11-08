// Five demo IT questions mapped to the five Skeld task stations.
// Replace the wording/answers here when the team connects real question-bank data.
export const TASK_QUESTIONS = {
    skeld_task_01: {
        number: 1,
        type: 'multiple-choice',
        typeLabel: 'TRẮC NGHIỆM',
        title: 'JavaScript',
        question: 'Trong JavaScript, từ khóa nào dùng để khai báo một biến có phạm vi khối (block scope) và cho phép gán lại giá trị?',
        options: [
            { value: 'const', label: 'const', hint: 'Không thể gán lại giá trị' },
            { value: 'let', label: 'let', hint: 'Có thể gán lại giá trị' },
            { value: 'static', label: 'static', hint: 'Từ khóa khai báo thành viên tĩnh' },
            { value: 'final', label: 'final', hint: 'Không phải từ khóa khai báo biến của JavaScript' }
        ],
        answer: 'let',
        explanation: 'let khai báo biến có phạm vi khối và có thể được gán lại.'
    },
    skeld_task_02: {
        number: 2,
        type: 'multiple-choice',
        typeLabel: 'TRẮC NGHIỆM',
        title: 'Lập trình C++',
        question: 'Trong C++, kiểu dữ liệu cơ bản nào được dùng để biểu diễn hai giá trị đúng (true) và sai (false)?',
        options: [
            { value: 'int', label: 'int', hint: 'Số nguyên' },
            { value: 'char', label: 'char', hint: 'Ký tự' },
            { value: 'bool', label: 'bool', hint: 'Logic đúng / sai' },
            { value: 'float', label: 'float', hint: 'Số thực' }
        ],
        answer: 'bool',
        explanation: 'Kiểu bool chỉ có hai giá trị logic: true và false.'
    },
    skeld_task_03: {
        number: 3,
        type: 'multiple-choice',
        typeLabel: 'TRẮC NGHIỆM',
        title: 'Cơ sở dữ liệu',
        question: 'Trong SQL, mệnh đề nào được sử dụng để lọc các bản ghi theo một hoặc nhiều điều kiện?',
        options: [
            { value: 'ORDER BY', label: 'ORDER BY', hint: 'Sắp xếp kết quả' },
            { value: 'WHERE', label: 'WHERE', hint: 'Lọc bản ghi theo điều kiện' },
            { value: 'GROUP BY', label: 'GROUP BY', hint: 'Nhóm các bản ghi' },
            { value: 'INSERT', label: 'INSERT', hint: 'Thêm dữ liệu mới' }
        ],
        answer: 'WHERE',
        explanation: 'WHERE lọc các dòng thỏa mãn điều kiện trong câu truy vấn.'
    },
    skeld_task_04: {
        number: 4,
        type: 'fill-blank',
        typeLabel: 'ĐIỀN KHUYẾT',
        title: 'HTML',
        question: 'Trong HTML, thẻ nào được sử dụng để tạo một siêu liên kết (hyperlink) dẫn đến trang web hoặc tài nguyên khác?',
        placeholder: 'Nhập tên thẻ, ví dụ: a',
        answer: 'a',
        acceptedAnswers: ['a', '<a>', '</a>', 'thẻ a', 'the a'],
        explanation: 'Thẻ <a> (anchor) được dùng để tạo liên kết trong HTML.'
    },
    skeld_task_05: {
        number: 5,
        type: 'fill-blank',
        typeLabel: 'ĐIỀN KHUYẾT',
        title: 'CSS',
        question: 'Trong CSS, thuộc tính nào được sử dụng để thay đổi màu sắc của nội dung văn bản?',
        placeholder: 'Nhập tên thuộc tính CSS',
        answer: 'color',
        acceptedAnswers: ['color'],
        explanation: 'Thuộc tính color điều khiển màu chữ của phần tử.'
    }
};

export function getTaskQuestion(taskId) {
    return TASK_QUESTIONS[taskId] ?? null;
}
