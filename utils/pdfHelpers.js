// 日本語をPDF標準のしおりに埋め込むためのUTF-16BE変換
export const toUTF16BE = (str) => {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        let charCode = str.charCodeAt(i).toString(16).toUpperCase();
        while (charCode.length < 4) charCode = '0' + charCode;
        hex += charCode;
    }
    return 'FEFF' + hex;
};