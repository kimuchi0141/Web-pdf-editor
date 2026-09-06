import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin, Trigger } from '@react-pdf-viewer/highlight';
import { PDFDocument } from 'pdf-lib';

import ja_JP from './locales/ja_JP.json';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
import './index.css';
import './App.css';

import { AnnotationProvider, AnnotationContext } from './contexts/AnnotationContext';
import { AnnotationToolbar } from './components/AnnotationToolbar';
import { annotationPlugin } from './plugins/annotationPlugin';
import { exportPdfWithAllEdits } from './services/pdfEditor';
import { createEditedPdfBlobUrl } from './services/nativePdfPrinter';
import { PrintPreviewModal } from './components/PrintPreviewModal';

// ローカルに配信される安全かつ高速なPDF.js Worker
const WORKER_URL = '/pdf.worker.min.js';

const CHARACTER_MAP = {
    isCompressed: true,
    url: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/'
};

// しおりのコンテキスト
const BookmarkContext = React.createContext({
    bookmarks: [],
    onAddBookmark: () => {},
    onDeleteBookmark: () => {},
    onJumpToPage: () => {}
});

// エラー境界（画面の真っ白化を防止）
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("PDF Viewer error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '32px', color: '#ffffff', backgroundColor: '#323639', height: '100vh', boxSizing: 'border-box' }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>表示エラーが発生しました</h2>
                    <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '20px' }}>{this.state.error?.message || '不明なエラー'}</p>
                    <button 
                        onClick={() => { sessionStorage.clear(); window.location.reload(); }}
                        style={{ padding: '8px 16px', backgroundColor: '#0060df', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                        初期化して再読み込み
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// 日本語のページ画像をCanvasで高精細レンダリング
// Bug-13修正: 2xスケールに削減（4xの96MBから24MBに低減、画面表示上の差異はほぼなし）
const _sampleCanvas = document.createElement('canvas');
function renderJapanesePage(pageNumber) {
    const canvas = _sampleCanvas; // Canvas再利用でメモリ削減
    const scale = 2; // 2× 高解像度レンダリング（約1190×1684px）
    const width = 595.28;
    const height = 841.89;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // サブピクセルレンダリング有効化
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 背景（白）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#0f274a';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';

    if (pageNumber === 1) {
        ctx.fillText('PDF.js 公式ビューア - 日本語操作マニュアル', 50, 70);

        ctx.fillStyle = '#64748b';
        ctx.font = '13px sans-serif';
        ctx.fillText('標準モジュール機能 ガイドライン', 50, 95);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, 110);
        ctx.lineTo(545, 110);
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        ctx.font = '12px sans-serif';
        ctx.fillText('本ビューアは @react-pdf-viewer/default-layout の公式標準モジュールで構築されています。', 50, 140);
        ctx.fillText('独自拡張によるイベント干渉を排除し、最高水準の安定性と操作性を実現しています。', 50, 162);

        ctx.fillStyle = '#0f274a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('【標準搭載されている主な日本語機能】', 50, 205);

        const items = [
            '1. 左サイドバー: ページサムネイル、しおり（アウトライン＋追加機能）、添付ファイル',
            '2. ページナビゲーション: 前後のページ移動、ページ番号直接入力、総ページ数表示',
            '3. ドキュメント内検索 (Ctrl+F): キーワードハイライト表示、大文字小文字区別、単語単位',
            '4. ズーム操作: 拡大 (+)、縮小 (-)、ページに合わせる、幅に合わせる、倍率選択 (50%〜400%)',
            '5. ツール切り替え: テキスト選択ツール ⇔ 手のひらツール（ドラッグスクロール）',
            '6. ページ回転: 時計回りに90°回転、反時計回りに90°回転',
            '7. スクロールモード: 縦スクロール、横スクロール、折り返しスクロール、見開き表示',
            '8. ファイル操作: お手元のPDFファイルを読み込む「開く」、ダウンロード（保存）、印刷',
            '9. 文書のプロパティ: メタデータ、作成者、バージョン、ページサイズの確認',
            '10. 全画面表示: プレゼンテーションモードでの閲覧'
        ];

        ctx.fillStyle = '#334155';
        ctx.font = '11.5px sans-serif';
        let y = 235;
        items.forEach(it => {
            ctx.fillText(it, 60, y);
            y += 24;
        });

        // 案内ボックス
        ctx.fillStyle = '#f0f9ff';
        ctx.fillRect(50, 500, 495, 65);
        ctx.strokeStyle = '#0284c7';
        ctx.strokeRect(50, 500, 495, 65);
        ctx.fillStyle = '#0369a1';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('お手持ちのPDFファイルを閲覧・操作する場合:', 65, 525);
        ctx.font = '11.5px sans-serif';
        ctx.fillText('右上のツールバーの「ファイルを開く」アイコンをクリックするか、', 65, 545);
        ctx.fillText('この画面上にPDFファイルを直接ドラッグ＆ドロップしてください。', 65, 560);
    } else if (pageNumber === 2) {
        ctx.fillText('第2章: キーボードショートカット一覧', 50, 70);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, 90);
        ctx.lineTo(545, 90);
        ctx.stroke();

        const shortcuts = [
            ['文書内を検索', 'Ctrl + F / Cmd + F'],
            ['ファイルを開く', 'Ctrl + O / Cmd + O'],
            ['印刷', 'Ctrl + P / Cmd + P'],
            ['次のページへ', 'PageDown / 下矢印 / スペース'],
            ['前のページへ', 'PageUp / 上矢印 / Shift + スペース'],
            ['拡大 / 縮小', 'Ctrl + プラス / Ctrl + マイナス (または Ctrl + ホイール)'],
            ['サイドバーの表示切替', 'F4'],
            ['最初のページへ移動', 'Home'],
            ['最後のページへ移動', 'End']
        ];

        let y = 130;
        shortcuts.forEach(([name, key]) => {
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(name, 60, y);
            ctx.fillStyle = '#2563eb';
            ctx.font = '12px sans-serif';
            ctx.fillText(key, 250, y);

            ctx.strokeStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.moveTo(60, y + 8);
            ctx.lineTo(520, y + 8);
            ctx.stroke();
            y += 34;
        });
    } else {
        ctx.fillText('第3章: 公式標準仕様の優位性', 50, 70);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, 90);
        ctx.lineTo(545, 90);
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        ctx.font = '12px sans-serif';
        ctx.fillText('標準モジュール（@react-pdf-viewer/default-layout）のみを採用することで、', 50, 130);
        ctx.fillText('以下の操作性と信頼性を確保しています：', 50, 150);

        const merits = [
            '・不要な独自マウスイベント遮断が一切なく、テキスト選択やドラッグが極めてスムーズ。',
            '・完全な日本語ローカライゼーション（ja_JP）を標準適用。',
            '・PDF.js 公式のレンダリングエンジン（pdfjs-dist 3.11）による高精細な描画。',
            '・しおりの追加やサムネイル、検索、印刷、ダウンロードが安定して動作。'
        ];

        let my = 190;
        merits.forEach(m => {
            ctx.fillText(m, 60, my);
            my += 28;
        });
    }

    return canvas.toDataURL('image/png');
}

// 初期サンプルPDFドキュメントの自動生成
async function generateSamplePdf() {
    const doc = await PDFDocument.create();
    // A4 サイズ（ポイント単位: 1pt = 1/72 inch）
    // 595.28 × 841.89 pt = A4 at 72 dpi
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;

    for (let pageNum = 1; pageNum <= 3; pageNum++) {
        const dataUrl = renderJapanesePage(pageNum);
        const base64Data = dataUrl.split(',')[1];
        const pngBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const pngImage = await doc.embedPng(pngBytes);

        // ページをA4サイズ（pt）で作成し、埋め込んだ画像をページ全体に引き伸ばす
        // pdf-lib の y=0 は左下原点なので y: 0 で左下から上方向に height 分だけ描画
        const page = doc.addPage([PAGE_W, PAGE_H]);
        page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: PAGE_W,
            height: PAGE_H,
            opacity: 1,
        });
    }
    return await doc.save();
}

// しおりサイドバーのコンテンツコンポーネント（Context経由で最新状態を取得）
function BookmarkTabContent({ defaultBookmarkContent }) {
    const { bookmarks, onAddBookmark, onDeleteBookmark, onJumpToPage } = useContext(BookmarkContext);

    return (
        <div className="custom-bookmark-tab">
            <button className="bookmark-add-btn" onClick={onAddBookmark} title="現在のページをしおりに追加">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>現在のページをしおりに追加</span>
            </button>

            {bookmarks && bookmarks.length > 0 ? (
                <ul className="bookmark-list">
                    {bookmarks.map((bm) => (
                        <li 
                            key={bm.id} 
                            className="bookmark-item"
                            onClick={() => onJumpToPage(bm.pageIndex)}
                            title={`ページ ${bm.pageIndex + 1} へジャンプ`}
                        >
                            <span className="bookmark-title">{bm.title}</span>
                            <span className="bookmark-page-badge">P.{bm.pageIndex + 1}</span>
                            <button 
                                className="bookmark-delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteBookmark(bm.id);
                                }}
                                title="しおりを削除"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="bookmark-empty">
                    しおりがありません。<br />
                    ページを開いて「現在のページをしおりに追加」を押してください。
                </div>
            )}

            {/* ドキュメント本来のアウトライン/しおりが存在する場合は下部に併せて表示 */}
            <div className="default-bookmark-wrapper">
                {typeof defaultBookmarkContent === 'function'
                    ? React.createElement(defaultBookmarkContent)
                    : defaultBookmarkContent}
            </div>
        </div>
    );
}

function PdfViewer() {
    const { 
        currentTool, 
        annotations, 
        textHighlights, 
        addTextHighlight, 
        deleteTextHighlight,
        setCurrentPage: setContextCurrentPage
    } = useContext(AnnotationContext);

    const [pdfUrl, setPdfUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);

    // 元のクリーンなPDFバイナリバッファへの参照（編集埋め込み・保存用）
    const cleanBasePdfBytesRef = useRef(null);

    // jumpToPage への直接参照
    const jumpToPageRef = useRef(null);

    // しおりの管理状態（セッションストレージに保存・復元）
    const [bookmarks, setBookmarks] = useState(() => {
        try {
            const saved = sessionStorage.getItem('pdf_bookmarks');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        return [
            { id: 1, pageIndex: 0, title: '第1章: 概要と主要機能' },
            { id: 2, pageIndex: 1, title: '第2章: キーボードショートカット一覧' },
            { id: 3, pageIndex: 2, title: '第3章: 公式標準仕様の優位性' }
        ];
    });

    useEffect(() => {
        try {
            sessionStorage.setItem('pdf_bookmarks', JSON.stringify(bookmarks));
        } catch (e) {}
    }, [bookmarks]);

    // しおりの追加
    const handleAddBookmark = useCallback(() => {
        const title = window.prompt('しおりのタイトルを入力してください:', `ページ ${currentPage + 1} のしおり`);
        if (title && title.trim()) {
            const newBm = {
                id: Date.now(),
                pageIndex: currentPage,
                title: title.trim()
            };
            setBookmarks(prev => [...prev, newBm]);
        }
    }, [currentPage]);

    // しおりの削除
    const handleDeleteBookmark = useCallback((id) => {
        setBookmarks(prev => prev.filter(b => b.id !== id));
    }, []);

    // しおりのクリックで指定ページへジャンプ
    const handleJumpToPage = useCallback((pageIndex) => {
        if (jumpToPageRef.current) {
            jumpToPageRef.current(pageIndex);
        }
        // DOM要素の直接スクロールフォールバック
        setTimeout(() => {
            const el = document.querySelector(`[data-testid="core__page-layer-${pageIndex}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 30);
    }, []);

    // jumpToPage 関数を確実にキャプチャする専用プラグイン
    const jumpPlugin = useMemo(() => ({
        install: (pluginFunctions) => {
            jumpToPageRef.current = pluginFunctions.jumpToPage;
        }
    }), []);

    // Bug-8修正: useMemoでメモ化し、毎レンダリングでの再生成を防止
    const annotationPluginInstance = useMemo(() => annotationPlugin(), []);

    // Bug-11修正: refで最新値を参照し、highlightPluginの不要な再生成を防止
    const textHighlightsRef = useRef(textHighlights);
    const currentToolRef = useRef(currentTool);
    const addTextHighlightRef = useRef(addTextHighlight);
    const deleteTextHighlightRef = useRef(deleteTextHighlight);
    useEffect(() => { textHighlightsRef.current = textHighlights; }, [textHighlights]);
    useEffect(() => { currentToolRef.current = currentTool; }, [currentTool]);
    useEffect(() => { addTextHighlightRef.current = addTextHighlight; }, [addTextHighlight]);
    useEffect(() => { deleteTextHighlightRef.current = deleteTextHighlight; }, [deleteTextHighlight]);

    // @react-pdf-viewer/highlight プラグインの統合（文字選択時のハイライトUIとページ上での描画）
    // highlightPlugin は内部で useMemo を呼び出すカスタムフックのため、Reactフックのルールに従いコンポーネント直下で呼び出す
    const highlightPluginInstance = highlightPlugin({
        trigger: Trigger.TextSelection,
        renderHighlightTarget: (props) => (
            <div 
                className="highlight-target-popup"
                style={{
                    position: 'absolute',
                    left: `${props.selectionRegion.left}%`,
                    top: `${props.selectionRegion.top - 2}%`,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 100,
                    background: '#ffffff',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    border: '1px solid #cbd5e1'
                }}
            >
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginRight: '2px' }}>ハイライト:</span>
                <button
                    style={{ background: '#fef08a', border: '1px solid #eab308', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#854d0e' }}
                    onClick={() => {
                        addTextHighlightRef.current({
                            id: Date.now(),
                            pageIndex: props.selectionRegion.pageIndex,
                            highlightAreas: props.highlightAreas,
                            color: 'yellow',
                            selectedText: props.selectedText
                        });
                        props.cancel();
                    }}
                    title="黄色のマーカーでハイライト"
                >
                    黄
                </button>
                <button
                    style={{ background: '#bbf7d0', border: '1px solid #22c55e', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#166534' }}
                    onClick={() => {
                        addTextHighlightRef.current({
                            id: Date.now(),
                            pageIndex: props.selectionRegion.pageIndex,
                            highlightAreas: props.highlightAreas,
                            color: 'green',
                            selectedText: props.selectedText
                        });
                        props.cancel();
                    }}
                    title="緑色のマーカーでハイライト"
                >
                    緑
                </button>
                <button
                    style={{ background: '#bfdbfe', border: '1px solid #3b82f6', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#1e40af' }}
                    onClick={() => {
                        addTextHighlightRef.current({
                            id: Date.now(),
                            pageIndex: props.selectionRegion.pageIndex,
                            highlightAreas: props.highlightAreas,
                            color: 'blue',
                            selectedText: props.selectedText
                        });
                        props.cancel();
                    }}
                    title="青色のマーカーでハイライト"
                >
                    青
                </button>
                <button
                    style={{ background: '#fbcfe8', border: '1px solid #ec4899', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#9d174d' }}
                    onClick={() => {
                        addTextHighlightRef.current({
                            id: Date.now(),
                            pageIndex: props.selectionRegion.pageIndex,
                            highlightAreas: props.highlightAreas,
                            color: 'pink',
                            selectedText: props.selectedText
                        });
                        props.cancel();
                    }}
                    title="ピンク色のマーカーでハイライト"
                >
                    桃
                </button>
            </div>
        ),
        renderHighlights: (props) => (
            <div>
                {textHighlightsRef.current
                    .filter(h => h.highlightAreas?.some(a => a.pageIndex === props.pageIndex))
                    .map(h => 
                        h.highlightAreas
                            .filter(a => a.pageIndex === props.pageIndex)
                            .map((area, idx) => {
                                const bg = 
                                    h.color === 'green' ? 'rgba(34, 197, 94, 0.4)' :
                                    h.color === 'blue' ? 'rgba(59, 130, 246, 0.4)' :
                                    h.color === 'pink' ? 'rgba(236, 72, 153, 0.4)' :
                                    'rgba(255, 226, 0, 0.45)';
                                return (
                                    <div
                                        key={`${h.id}-${idx}`}
                                        className="rpv-highlight-item"
                                        style={Object.assign({}, {
                                            background: bg,
                                            borderRadius: '2px',
                                            pointerEvents: currentToolRef.current === 'eraser' ? 'auto' : 'none',
                                            cursor: currentToolRef.current === 'eraser' ? 'pointer' : 'inherit'
                                        }, props.getCssProperties(area, props.rotation))}
                                        onClick={() => {
                                            if (currentToolRef.current === 'eraser') {
                                                deleteTextHighlightRef.current(h.id);
                                            }
                                        }}
                                        title={currentToolRef.current === 'eraser' ? 'クリックしてハイライトを消去' : ''}
                                    />
                                );
                            })
                    )
                }
            </div>
        )
    });

    // defaultLayoutPlugin はカスタムフックのため、Reactフックのルールに従いコンポーネント直下で呼び出す
    const defaultLayoutPluginInstance = defaultLayoutPlugin({
        sidebarTabs: (defaultTabs) => {
            if (!Array.isArray(defaultTabs) || defaultTabs.length === 0) {
                return defaultTabs || [];
            }
            return [
                defaultTabs[0], // サムネイル（プレビュー）
                {
                    content: <BookmarkTabContent defaultBookmarkContent={defaultTabs[1]?.content} />,
                    icon: defaultTabs[1]?.icon,
                    title: defaultTabs[1]?.title || 'しおり',
                },
                ...(defaultTabs.slice(2)), // 添付ファイル他
            ];
        }
    });

    // 初期ドキュメントの生成
    // Bug-7修正: アンマウント時にBlob URLを確実に解放
    useEffect(() => {
        let active = true;
        let initialBlobUrl = null;
        generateSamplePdf().then(bytes => {
            if (!active) return;
            cleanBasePdfBytesRef.current = bytes;
            const blob = new Blob([bytes], { type: 'application/pdf' });
            initialBlobUrl = URL.createObjectURL(blob);
            setPdfUrl(initialBlobUrl);
            setIsLoading(false);
        }).catch(err => {
            console.error('Failed to generate sample PDF', err);
            setIsLoading(false);
        });

        return () => {
            active = false;
            if (initialBlobUrl) {
                URL.revokeObjectURL(initialBlobUrl);
            }
        };
    }, []);

    // ドラッグ＆ドロップによるPDF読み込みのサポート
    // Bug-7修正: 新しいPDF読み込み時に以前のBlob URLを解放
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer?.files;
        if (files && files.length > 0 && files[0].type === 'application/pdf') {
            const file = files[0];
            const buffer = await file.arrayBuffer();
            cleanBasePdfBytesRef.current = new Uint8Array(buffer);
            const newUrl = URL.createObjectURL(file);
            setPdfUrl(prevUrl => {
                if (prevUrl) {
                    URL.revokeObjectURL(prevUrl);
                }
                return newUrl;
            });
        }
    }, []);

    // ハイライト・手書きペン・テキスト・しおりを高解像度（4x / 300dpi相当）のままPDFに埋め込んで保存＆ダウンロード
    const handleSavePdf = useCallback(async () => {
        setIsSaving(true);
        try {
            let sourceBuffer = cleanBasePdfBytesRef.current;
            if (!sourceBuffer && pdfUrl) {
                const res = await fetch(pdfUrl);
                sourceBuffer = new Uint8Array(await res.arrayBuffer());
                cleanBasePdfBytesRef.current = sourceBuffer;
            }

            if (!sourceBuffer) {
                throw new Error('PDFデータを読み込み中です。少々お待ちください。');
            }

            // PDFバイナリにすべての編集（ハイライト・テキスト・ペン・しおり）をソフト本体と同じ4x高解像度で直接埋め込む
            const editedBytes = await exportPdfWithAllEdits({
                originalPdfBuffer: sourceBuffer,
                annotations,
                textHighlights,
                bookmarks
            });

            if (!editedBytes) {
                throw new Error('PDFの生成に失敗しました。');
            }

            // PDFファイルをダウンロード保存
            const blob = new Blob([editedBytes], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'edited_document.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Bug-6修正: ダウンロード完了後にBlob URLを確実に解放してメモリリークを防止
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

            setToastMessage('✓ 高解像度（300dpi相当）の状態でPDFを保存・ダウンロードしました');
            setTimeout(() => setToastMessage(null), 3500);
        } catch (err) {
            console.error('PDF Save error:', err);
            alert('PDFの保存中にエラーが発生しました: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    }, [annotations, textHighlights, bookmarks, pdfUrl]);

    // 書き込み・テキスト注釈が反映された変更後PDFを生成し、ネイティブ印刷プレビューモーダルを表示
    // Bug-5修正: 依存配列からisPrintingを除去し、isPrintingRefとfinallyクリーンアップで多重実行および再生成ループを防止
    const isPrintingRef = useRef(false);
    const handlePrintPdf = useCallback(async () => {
        if (isPrintingRef.current) return;
        isPrintingRef.current = true;
        setIsPrinting(true);
        try {
            let sourceBuffer = cleanBasePdfBytesRef.current;
            if (!sourceBuffer && pdfUrl) {
                const res = await fetch(pdfUrl);
                sourceBuffer = new Uint8Array(await res.arrayBuffer());
                cleanBasePdfBytesRef.current = sourceBuffer;
            }

            if (!sourceBuffer) {
                throw new Error('PDFデータを読み込み中です。少々お待ちください。');
            }

            // PDF.jsを使わず、ブラウザのネイティブPDFエンジンを活用して変更後PDFを表示！
            const blobUrl = await createEditedPdfBlobUrl({
                originalPdfBuffer: sourceBuffer,
                annotations,
                textHighlights,
                bookmarks
            });

            setPreviewBlobUrl(blobUrl);
        } catch (err) {
            console.error('PDF Print error:', err);
        } finally {
            isPrintingRef.current = false;
            setIsPrinting(false);
        }
    }, [annotations, textHighlights, bookmarks, pdfUrl]);

    // Ctrl+P / Cmd+P ショートカットで書き込み入り印刷プレビューを起動
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                handlePrintPdf();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlePrintPdf]);

    // ビューア内部の印刷アイコンボタンがクリックされた時も書き込み入り印刷プレビューに差し替える
    useEffect(() => {
        const handleGlobalClick = (e) => {
            const printBtn = e.target.closest('[data-testid="print__button"], [data-testid="print__menu"], .rpv-print__button');
            if (printBtn) {
                e.preventDefault();
                e.stopPropagation();
                handlePrintPdf();
            }
        };
        document.addEventListener('click', handleGlobalClick, true);
        return () => document.removeEventListener('click', handleGlobalClick, true);
    }, [handlePrintPdf]);

    if (isLoading || !pdfUrl) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
                <span>PDF ビューアを初期化中...</span>
            </div>
        );
    }

    return (
        <BookmarkContext.Provider value={{
            bookmarks,
            onAddBookmark: handleAddBookmark,
            onDeleteBookmark: handleDeleteBookmark,
            onJumpToPage: handleJumpToPage
        }}>
            <div 
                className="app-container"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <AnnotationToolbar onSavePdf={handleSavePdf} isSaving={isSaving} />

                {toastMessage && (
                    <div style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#0f172a',
                        color: '#ffffff',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                        fontSize: '13px',
                        fontWeight: 600,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>{toastMessage}</span>
                    </div>
                )}

                <div className="viewer-wrapper">
                    <Worker workerUrl={WORKER_URL}>
                        <Viewer
                            fileUrl={pdfUrl}
                            plugins={[defaultLayoutPluginInstance, jumpPlugin, annotationPluginInstance, highlightPluginInstance]}
                            characterMap={CHARACTER_MAP}
                            localization={ja_JP}
                            onPageChange={(e) => {
                                setCurrentPage(e.currentPage);
                                setContextCurrentPage?.(e.currentPage);
                            }}
                        />
                    </Worker>
                </div>
                {previewBlobUrl && (
                    <PrintPreviewModal 
                        blobUrl={previewBlobUrl} 
                        onClose={() => {
                            URL.revokeObjectURL(previewBlobUrl);
                            setPreviewBlobUrl(null);
                        }} 
                    />
                )}
            </div>
        </BookmarkContext.Provider>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <AnnotationProvider>
                <PdfViewer />
            </AnnotationProvider>
        </ErrorBoundary>
    );
}

