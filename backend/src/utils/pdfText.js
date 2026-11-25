// Lấy chữ từ PDF, bọc phần in đậm trong **...** (đề thường in đậm đáp án đúng).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * @param {Buffer} buffer nội dung file PDF
 * @returns {Promise<string>} văn bản, mỗi dòng PDF một dòng, chữ đậm dạng **...**
 */
export async function pdfToMarkedText(buffer) {
    const doc = await getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
    const lines = [];
    for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        await page.getOperatorList(); // nạp font vào commonObjs để đọc được tên font
        const { items } = await page.getTextContent();

        let line = "";
        let lastY = null;
        let inBold = false;
        const flush = () => {
            if (inBold) line += "**";
            inBold = false;
            if (line.trim()) lines.push(line.replace(/\*\*\s*\*\*/g, " ").trimEnd());
            line = "";
        };

        for (const item of items) {
            if (!("str" in item)) continue;
            const y = Math.round(item.transform[5]);
            if (lastY !== null && Math.abs(y - lastY) > 2) flush();
            lastY = y;

            let fontName = "";
            try {
                fontName = page.commonObjs.get(item.fontName)?.name ?? "";
            } catch {
                // font chưa nạp được -> coi như chữ thường
            }
            const bold = /bold|black|heavy/i.test(fontName);

            if (item.str.trim()) {
                if (bold && !inBold) { line += "**"; inBold = true; }
                if (!bold && inBold) { line += "**"; inBold = false; }
            }
            line += item.str;
            if (item.hasEOL) {
                flush();
                lastY = null;
            }
        }
        flush();
        page.cleanup();
    }
    await doc.destroy();
    return lines.join("\n");
}
