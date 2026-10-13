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
import { printPdfDirectNative } from './services/nativePdfPrinter';

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
    const hasBookmarks = Boolean(bookmarks && bookmarks.length > 0);

    return (
        <div className={`custom-bookmark-tab ${hasBookmarks ? 'has-bookmarks' : ''}`}>
            <button className="bookmark-add-btn" onClick={onAddBookmark} title="現在のページをしおりに追加">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                <span>現在のページをしおりに追加</span>
            </button>

            {hasBookmarks ? (
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
                                aria-label="しおりを削除"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
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
        resetAllAnnotations,
        setCurrentPage: setContextCurrentPage
    } = useContext(AnnotationContext);

    const [pdfUrl, setPdfUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const fileInputRef = useRef(null);

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

    // 未保存の変更状態の追跡（ブラウザ再読み込み時の離脱防止用）
    const lastSavedSnapshotRef = useRef(null);
    const hasUnsavedChangesRef = useRef(false);

    // 初期ドキュメント読み込み完了時に初期スナップショットを記録
    useEffect(() => {
        if (!isLoading && pdfUrl && lastSavedSnapshotRef.current === null) {
            lastSavedSnapshotRef.current = JSON.stringify({
                annotations,
                textHighlights,
                bookmarks
            });
        }
    }, [isLoading, pdfUrl, annotations, textHighlights, bookmarks]);

    // 編集内容が初期/保存時点から変化しているかを判定
    useEffect(() => {
        if (lastSavedSnapshotRef.current !== null) {
            const currentSnapshot = JSON.stringify({
                annotations,
                textHighlights,
                bookmarks
            });
            hasUnsavedChangesRef.current = currentSnapshot !== lastSavedSnapshotRef.current;
        }
    }, [annotations, textHighlights, bookmarks]);

    // ブラウザの再読み込み・タブ閉じ時に未保存の変更がある場合はブラウザ標準の確認ダイアログを表示
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChangesRef.current) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

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
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)',
                    borderRadius: '20px',
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid #e1e3e1'
                }}
            >
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#444746', marginRight: '2px' }}>ハイライト:</span>
                <button
                    style={{ background: '#fff9c4', border: '1px solid #fbc02d', borderRadius: '12px', padding: '3px 10px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#7c5800', transition: 'transform 0.1s ease' }}
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
                    style={{ background: '#c8f5d0', border: '1px solid #34a853', borderRadius: '12px', padding: '3px 10px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#0d652d', transition: 'transform 0.1s ease' }}
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
                    style={{ background: '#d3e3fd', border: '1px solid #0b57d0', borderRadius: '12px', padding: '3px 10px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#041e49', transition: 'transform 0.1s ease' }}
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
                    style={{ background: '#ffd8e4', border: '1px solid #e91e63', borderRadius: '12px', padding: '3px 10px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#881144', transition: 'transform 0.1s ease' }}
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

    // ファイルを開くダイアログの起動
    const handleTriggerOpenFile = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    }, []);

    // 任意のPDFファイル（Fileオブジェクト）を読み込み、状態を安全に切り替える共通処理
    const handleLoadPdfFile = useCallback(async (file) => {
        if (!file) return;
        try {
            setIsLoading(true);
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            cleanBasePdfBytesRef.current = bytes;

            const newUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            setPdfUrl(prevUrl => {
                if (prevUrl) {
                    URL.revokeObjectURL(prevUrl);
                }
                return newUrl;
            });

            // 新しいPDFの読み込みに合わせて前ドキュメントのアノテーション・しおり・ページ番号を初期化
            resetAllAnnotations?.();
            setBookmarks([]);
            setCurrentPage(0);
            setContextCurrentPage?.(0);
            setIsLoading(false);

            // 新しいPDF読み込み時は未編集状態としてスナップショットを初期化
            lastSavedSnapshotRef.current = JSON.stringify({
                annotations: [],
                textHighlights: [],
                bookmarks: []
            });
            hasUnsavedChangesRef.current = false;

            setToastMessage(`✓ PDFファイル「${file.name}」を開きました`);
            setTimeout(() => setToastMessage(null), 3000);
        } catch (err) {
            console.error('Failed to load PDF file:', err);
            setIsLoading(false);
            alert('PDFファイルの読み込みに失敗しました: ' + err.message);
        }
    }, [resetAllAnnotations, setContextCurrentPage]);

    const handleFileInputChange = useCallback((e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleLoadPdfFile(files[0]);
        }
    }, [handleLoadPdfFile]);

    // Ctrl+O / Cmd+O ショートカットでファイルを開くダイアログを起動
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                handleTriggerOpenFile();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleTriggerOpenFile]);

    // ウィンドウ全体での安全かつ確実なドラッグ＆ドロップ対応（拡張子・MIME両対応）
    useEffect(() => {
        const handleWindowDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
        };

        const handleWindowDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.relatedTarget === null || e.clientX <= 0 || e.clientY <= 0) {
                setIsDraggingOver(false);
            }
        };

        const handleWindowDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                const isPdf = file.name.toLowerCase().endsWith('.pdf') || 
                              file.type === 'application/pdf' || 
                              file.type === 'application/x-pdf';
                if (isPdf) {
                    await handleLoadPdfFile(file);
                } else {
                    alert('選択されたファイルはPDF形式ではありません。PDFファイルを選択してください。');
                }
            }
        };

        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('dragleave', handleWindowDragLeave);
        window.addEventListener('drop', handleWindowDrop);
        return () => {
            window.removeEventListener('dragover', handleWindowDragOver);
            window.removeEventListener('dragleave', handleWindowDragLeave);
            window.removeEventListener('drop', handleWindowDrop);
        };
    }, [handleLoadPdfFile]);

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

            // 保存成功時にスナップショットを更新して未保存フラグをリセット
            lastSavedSnapshotRef.current = JSON.stringify({
                annotations,
                textHighlights,
                bookmarks
            });
            hasUnsavedChangesRef.current = false;

            setToastMessage('✓ 高解像度（300dpi相当）の状態でPDFを保存・ダウンロードしました');
            setTimeout(() => setToastMessage(null), 3500);
        } catch (err) {
            console.error('PDF Save error:', err);
            alert('PDFの保存中にエラーが発生しました: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    }, [annotations, textHighlights, bookmarks, pdfUrl]);

    // 編集内容を反映したPDFを生成し、ブラウザー標準の印刷プレビューを開く
    const isPrintingRef = useRef(false);
    const handlePrintPdf = useCallback(async () => {
        if (isPrintingRef.current) return;
        isPrintingRef.current = true;
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

            await printPdfDirectNative({
                originalPdfBuffer: sourceBuffer,
                annotations,
                textHighlights,
                bookmarks
            });
        } catch (err) {
            console.error('PDF Print error:', err);
            alert('PDFの印刷プレビューを開けませんでした: ' + err.message);
        } finally {
            isPrintingRef.current = false;
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
            <div className="app-container">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept=".pdf,application/pdf,application/x-pdf" 
                    style={{ display: 'none' }} 
                    onChange={handleFileInputChange} 
                />

                <AnnotationToolbar 
                    onSavePdf={handleSavePdf} 
                    isSaving={isSaving} 
                    onOpenFile={handleTriggerOpenFile} 
                />

                {/* ドラッグ＆ドロップ時の視覚的ガイドオーバーレイ (Material Design 3) */}
                {isDraggingOver && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(211, 227, 253, 0.7)',
                        border: '3px dashed #0b57d0',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        backdropFilter: 'blur(6px)'
                    }}>
                        <div style={{
                            background: '#ffffff',
                            padding: '36px 56px',
                            borderRadius: '28px',
                            boxShadow: '0 16px 40px rgba(11, 87, 208, 0.2), 0 2px 6px rgba(0, 0, 0, 0.06)',
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#041e49',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '14px'
                        }}>
                            <svg width="52" height="52" viewBox="0 0 24 24" fill="#0b57d0">
                                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                            </svg>
                            <span>ここにPDFファイルをドロップして開く</span>
                        </div>
                    </div>
                )}

                {toastMessage && (
                    <div style={{
                        position: 'fixed',
                        bottom: '28px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1f1f1f',
                        color: '#f2f2f2',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.15)',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        letterSpacing: '0.1px'
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
                            onDocumentLoad={async (e) => {
                                try {
                                    const bytes = await e.doc.getData();
                                    if (bytes && bytes.length > 0) {
                                        cleanBasePdfBytesRef.current = bytes;
                                    }
                                } catch (err) {
                                    console.warn('Could not extract PDF bytes from loaded document', err);
                                }
                            }}
                            onPageChange={(e) => {
                                setCurrentPage(e.currentPage);
                                setContextCurrentPage?.(e.currentPage);
                            }}
                        />
                    </Worker>
                </div>
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
