import { PDFDocument, PDFName, PDFHexString, rgb } from 'pdf-lib';
import { toUTF16BE } from '../utils/pdfHelpers';

/**
 * ページごとの編集内容（手書きペン、ハイライト、テキスト）を高解像度（ソフト本体と同じ 4x スケール = 300dpi相当）の
 * 透過Canvasに描画し、高品位PNGとしてPDFページに重ね合わせる
 */
async function renderPageAnnotationsOverlay(pdfDoc, page, pageIndex, pageAnnotations, pageTextHighlights) {
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    // ソフト本体のレンダリングと同じ4倍スケール（約2381×3368px = 300dpi相当の高精細Retina出力）
    const SCALE = 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pageWidth * SCALE);
    canvas.height = Math.round(pageHeight * SCALE);
    const ctx = canvas.getContext('2d');

    ctx.scale(SCALE, SCALE);
    // 最高品質のアンチエイリアスと補間処理
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. テキスト選択ハイライトの描画
    pageTextHighlights.forEach(hl => {
        const colorName = hl.color || 'yellow';
        let fillColor = 'rgba(255, 226, 0, 0.45)';
        if (colorName === 'green') fillColor = 'rgba(34, 197, 94, 0.4)';
        if (colorName === 'blue') fillColor = 'rgba(59, 130, 246, 0.4)';
        if (colorName === 'pink' || colorName === 'red') fillColor = 'rgba(236, 72, 153, 0.45)';

        ctx.fillStyle = fillColor;
        (hl.highlightAreas || []).forEach(area => {
            if (area.pageIndex === pageIndex) {
                const rx = (area.left * pageWidth) / 100;
                const ry = (area.top * pageHeight) / 100;
                const rw = (area.width * pageWidth) / 100;
                const rh = (area.height * pageHeight) / 100;
                ctx.fillRect(rx, ry, rw, rh);
            }
        });
    });

    // 2. フリーハンドハイライトの描画（roundキャップ・joinにより、ソフトウェア上のSVGと完全に一致する滑らかなマーカー線）
    const highlights = pageAnnotations.filter(a => a.type === 'highlight' && a.points && a.points.length > 0);
    highlights.forEach(hl => {
        if (hl.points.length === 1) {
            ctx.fillStyle = hl.color || 'rgba(255, 226, 0, 0.45)';
            const r = (hl.strokeWidth || 16) / 2;
            ctx.beginPath();
            ctx.arc(hl.points[0].x, hl.points[0].y, r, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        ctx.beginPath();
        ctx.strokeStyle = hl.color || 'rgba(255, 226, 0, 0.45)';
        ctx.lineWidth = hl.strokeWidth || 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        hl.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    });

    // 3. 手書きペン線の描画（完全な滑らかさとアンチエイリアス）
    const penPaths = pageAnnotations.filter(a => a.type === 'path' && a.points && a.points.length > 0);
    penPaths.forEach(path => {
        if (path.points.length === 1) {
            ctx.fillStyle = path.color || '#2563eb';
            const r = (path.strokeWidth || 3) / 2;
            ctx.beginPath();
            ctx.arc(path.points[0].x, path.points[0].y, r, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        ctx.beginPath();
        ctx.strokeStyle = path.color || '#2563eb';
        ctx.lineWidth = path.strokeWidth || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        path.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    });

    // 4. テキストボックスの描画（システムフォントによる超高精細・美しい日本語レンダリング）
    const texts = pageAnnotations.filter(a => a.type === 'text' && a.text && a.text.trim() !== '');
    texts.forEach(txt => {
        const fontSize = txt.fontSize || 16;
        ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
        ctx.fillStyle = txt.color || '#1e293b';
        ctx.textBaseline = 'top';

        const lines = txt.text.split('\n');
        const lineH = fontSize * 1.3;
        lines.forEach((line, idx) => {
            ctx.fillText(line, txt.x + 2, txt.y + 2 + idx * lineH);
        });
    });

    // 透過PNG画像として出力し、PDFページに埋め込む
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    const pngBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const overlayImage = await pdfDoc.embedPng(pngBytes);

    // PDFページ全体にジャストサイズで重ね合わせ描画（高解像度Retina出力）
    page.drawImage(overlayImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        opacity: 1
    });
}

/**
 * すべての編集（テキスト選択ハイライト、フリーハンドハイライト、手書きペン線、テキストボックス、しおり）を
 * ソフトウェア上の高解像度（4x / 300dpi相当）のままPDFバイナリに埋め込んで保存用バイト列を生成する
 */
export const exportPdfWithAllEdits = async ({
    originalPdfBuffer,
    annotations = [],      // フリーハンド線、フリーハンドハイライト、テキストボックス
    textHighlights = [],   // テキスト選択ハイライト
    bookmarks = []         // しおり
}) => {
    if (!originalPdfBuffer) return null;
    const pdfDoc = await PDFDocument.load(originalPdfBuffer);
    const pages = pdfDoc.getPages();

    // ページごとに編集内容が存在するか判定し、高精細4xオーバーレイを描画
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const page = pages[pageIdx];
        const pageAnns = annotations.filter(a => a.pageIndex === pageIdx);
        const pageHls = textHighlights.filter(h => h.highlightAreas && h.highlightAreas.some(area => area.pageIndex === pageIdx));

        if (pageAnns.length > 0 || pageHls.length > 0) {
            await renderPageAnnotationsOverlay(pdfDoc, page, pageIdx, pageAnns, pageHls);
        }
    }

    // PDF標準のアノテーションメタデータ（/Highlight 辞書）も併せて付与
    for (const highlight of textHighlights) {
        const colorName = highlight.color || 'yellow';
        let highlightRgb = rgb(0.99, 0.88, 0.28);
        if (colorName === 'green') highlightRgb = rgb(0.13, 0.77, 0.37);
        if (colorName === 'blue') highlightRgb = rgb(0.23, 0.51, 0.96);
        if (colorName === 'pink' || colorName === 'red') highlightRgb = rgb(0.94, 0.27, 0.6);

        const areas = highlight.highlightAreas || [];
        for (const area of areas) {
            if (area.pageIndex >= 0 && area.pageIndex < pages.length) {
                const page = pages[area.pageIndex];
                const { width, height } = page.getSize();

                const left = (area.left * width) / 100;
                const top = height - (area.top * height) / 100;
                const rectW = (area.width * width) / 100;
                const rectH = (area.height * height) / 100;
                const bottom = top - rectH;

                try {
                    const annotRef = pdfDoc.context.nextRef();
                    const annotDict = pdfDoc.context.obj({
                        Type: 'Annot',
                        Subtype: 'Highlight',
                        Rect: [left, bottom, left + rectW, top],
                        QuadPoints: [left, top, left + rectW, top, left, bottom, left + rectW, bottom],
                        C: [highlightRgb.red, highlightRgb.green, highlightRgb.blue],
                        F: 4,
                    });
                    pdfDoc.context.assign(annotRef, annotDict);

                    let annots = page.node.get(PDFName.of('Annots'));
                    if (!annots) {
                        annots = pdfDoc.context.obj([]);
                        page.node.set(PDFName.of('Annots'), annots);
                    } else if (annots.constructor && annots.constructor.name === 'PDFRef') {
                        annots = pdfDoc.context.lookup(annots);
                    }
                    annots.push(annotRef);
                } catch (e) {
                    console.warn('Failed to add Highlight annot dictionary', e);
                }
            }
        }
    }

    // しおり（アウトライン）の埋め込み
    if (bookmarks && bookmarks.length > 0) {
        try {
            const outlinesDictRef = pdfDoc.context.nextRef();
            const outlineItemRefs = bookmarks.map(() => pdfDoc.context.nextRef());

            for (let i = 0; i < bookmarks.length; i++) {
                const bm = bookmarks[i];
                if (bm.pageIndex >= pages.length) continue;

                const pageRef = pages[bm.pageIndex].ref;
                const prevRef = i > 0 ? outlineItemRefs[i - 1] : null;
                const nextRef = i < bookmarks.length - 1 ? outlineItemRefs[i + 1] : null;
                const destArray = pdfDoc.context.obj([pageRef, PDFName.of('XYZ'), null, null, null]);

                const itemDict = pdfDoc.context.obj({
                    Title: PDFHexString.of(toUTF16BE(bm.title || bm.label || `ページ ${bm.pageIndex + 1}`)),
                    Parent: outlinesDictRef,
                    Dest: destArray,
                    ...(prevRef && { Prev: prevRef }),
                    ...(nextRef && { Next: nextRef }),
                });

                pdfDoc.context.assign(outlineItemRefs[i], itemDict);
            }

            const outlinesDict = pdfDoc.context.obj({
                Type: 'Outlines',
                First: outlineItemRefs[0],
                Last: outlineItemRefs[outlineItemRefs.length - 1],
                Count: bookmarks.length,
            });

            pdfDoc.context.assign(outlinesDictRef, outlinesDict);
            pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);
        } catch (e) {
            console.warn('Failed to embed bookmarks', e);
        }
    }

    return await pdfDoc.save();
};

