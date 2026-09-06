import { exportPdfWithAllEdits } from './pdfEditor';

/**
 * PDF.jsに依存せず、ブラウザのネイティブPDFエンジンを活用して
 * 変更後のPDF（手書き・ハイライト・テキスト反映済み）を直接印刷プレビュー・印刷するモジュール
 */
export async function createEditedPdfBlobUrl({
    originalPdfBuffer,
    annotations,
    textHighlights,
    bookmarks
}) {
    const editedBytes = await exportPdfWithAllEdits({
        originalPdfBuffer,
        annotations,
        textHighlights,
        bookmarks
    });

    if (!editedBytes) {
        throw new Error('変更後PDFの生成に失敗しました');
    }

    const blob = new Blob([editedBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
}

/**
 * 変更後PDFをブラウザのネイティブ印刷機能で直接印刷する
 */
export async function printPdfDirectNative({
    originalPdfBuffer,
    annotations,
    textHighlights,
    bookmarks
}) {
    const blobUrl = await createEditedPdfBlobUrl({
        originalPdfBuffer,
        annotations,
        textHighlights,
        bookmarks
    });

    return new Promise((resolve, reject) => {
        // 既存の印刷用iframeがあれば削除
        const oldIframe = document.getElementById('native-print-iframe');
        if (oldIframe) {
            oldIframe.remove();
        }

        const iframe = document.createElement('iframe');
        iframe.id = 'native-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '1000px';
        iframe.style.height = '1000px';
        iframe.style.border = 'none';
        iframe.src = blobUrl;

        let resolved = false;

        const cleanup = () => {
            setTimeout(() => {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
                URL.revokeObjectURL(blobUrl);
            }, 30000);
        };

        iframe.onload = () => {
            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        resolve(blobUrl);
                    }
                } catch (err) {
                    console.warn('Direct iframe print failed, falling back to window.open', err);
                    try {
                        const win = window.open(blobUrl, '_blank');
                        if (win) {
                            win.focus();
                            win.print();
                        }
                    } catch (e) {
                        console.error('Window open print also failed', e);
                    }
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        resolve(blobUrl);
                    }
                }
            }, 500);
        };

        iframe.onerror = (e) => {
            cleanup();
            reject(new Error('PDFの読み込みに失敗しました'));
        };

        document.body.appendChild(iframe);
    });
}
