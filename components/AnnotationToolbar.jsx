import React, { useContext } from 'react';
import { AnnotationContext } from '../contexts/AnnotationContext';
import './AnnotationToolbar.css';

// Material Symbols SVG Icons
const Icons = {
    Pan: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 24c-3.26 0-6.19-1.3-8.29-3.41L1 16.89l1.37-1.37c.36-.36.86-.56 1.37-.56h.46L8 16.48V3.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v8.5h1V1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v8.5h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v7.5h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V17c0 3.87-3.13 7-7 7z"/>
        </svg>
    ),
    Text: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/>
        </svg>
    ),
    Pen: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
    ),
    Highlight: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.75 7L14 3.25l-10 10V17h3.75l10-10zm2.96-2.96a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM2 20h20v2H2v-2z"/>
        </svg>
    ),
    Eraser: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.78-.78 2.05 0 2.83L6.44 21.4c.39.39.9.59 1.41.59H19c.55 0 1-.45 1-1s-.45-1-1-1h-9.74l8.28-8.28c.78-.78.78-2.05 0-2.83l-2.99-2.99c-.39-.39-.9-.59-1.41-.59zm-1.41 3.42l2.99 2.99-3.89 3.89-2.99-2.99 3.89-3.89zM8.42 16.72l2.99 2.99H7.85l-3.85-3.85 2.42-2.42 2 3.28z"/>
        </svg>
    ),
    FolderOpen: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
        </svg>
    ),
    Save: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
        </svg>
    ),
    Delete: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
    ),
    Info: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
    )
};

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
const TEXT_COLORS = [
    { label: '黒', value: '#1e293b' },
    { label: '赤', value: '#dc2626' },
    { label: '青', value: '#2563eb' },
    { label: '緑', value: '#16a34a' }
];

const PEN_SIZES = [
    { label: '1px (極細)', value: 1 },
    { label: '2px (細)', value: 2 },
    { label: '3px (標準)', value: 3 },
    { label: '5px (中太)', value: 5 },
    { label: '8px (太)', value: 8 },
    { label: '12px (特太)', value: 12 },
    { label: '18px (極太)', value: 18 }
];

const PEN_COLORS = [
    { label: '青', value: '#2563eb' },
    { label: '赤', value: '#dc2626' },
    { label: '黒', value: '#1e293b' },
    { label: '緑', value: '#16a34a' },
    { label: '橙', value: '#f97316' },
    { label: '紫', value: '#9333ea' }
];

const HIGHLIGHT_SIZES = [
    { label: '10px (細)', value: 10 },
    { label: '16px (標準)', value: 16 },
    { label: '24px (太)', value: 24 },
    { label: '32px (極太)', value: 32 }
];

const HIGHLIGHT_COLORS = [
    { label: '黄', value: 'rgba(255, 226, 0, 0.45)' },
    { label: '緑', value: 'rgba(34, 197, 94, 0.4)' },
    { label: '青', value: 'rgba(59, 130, 246, 0.4)' },
    { label: '桃', value: 'rgba(236, 72, 153, 0.4)' }
];

export function AnnotationToolbar({ onSavePdf, isSaving, onOpenFile }) {
    const { 
        currentTool, setCurrentTool, 
        textProperties, setTextProperties,
        penProperties, setPenProperties,
        highlightProperties, setHighlightProperties,
        selectedId, updateAnnotation, deleteAnnotation,
        annotations, clearSelection, addTextAtCurrentPage
    } = useContext(AnnotationContext);

    const handleTextButtonClick = (e) => {
        e.stopPropagation();
        addTextAtCurrentPage?.();
    };

    const selectedAnn = selectedId ? annotations.find(a => a.id === selectedId) : null;
    const isTextSelected = selectedAnn && selectedAnn.type === 'text';

    const handleTextSizeChange = (e) => {
        const newSize = parseInt(e.target.value, 10);
        setTextProperties(prev => ({ ...prev, fontSize: newSize }));
        
        if (isTextSelected) {
            updateAnnotation(selectedId, { fontSize: newSize });
        }
    };

    const handleTextColorChange = (color) => {
        setTextProperties(prev => ({ ...prev, color }));
        if (isTextSelected) {
            updateAnnotation(selectedId, { color });
        }
    };

    const handlePenSizeChange = (e) => {
        const strokeWidth = parseInt(e.target.value, 10);
        setPenProperties(prev => ({ ...prev, strokeWidth }));
    };

    const handlePenColorChange = (color) => {
        setPenProperties(prev => ({ ...prev, color }));
    };

    const handleHighlightSizeChange = (e) => {
        const strokeWidth = parseInt(e.target.value, 10);
        setHighlightProperties?.(prev => ({ ...prev, strokeWidth }));
    };

    const handleHighlightColorChange = (color) => {
        setHighlightProperties?.(prev => ({ ...prev, color }));
    };

    const currentFontSize = isTextSelected ? (selectedAnn.fontSize || textProperties.fontSize) : textProperties.fontSize;
    const currentTextColor = isTextSelected ? (selectedAnn.color || textProperties.color) : textProperties.color;

    return (
        <header className="annotation-toolbar" role="toolbar" aria-label="PDF注釈ツールバー">
            {/* ツール選択グループ (M3 Segmented / Tonal Chips) */}
            <div className="tool-group">
                <button 
                    className={`tool-btn ${currentTool === 'view' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('view'); }}
                    title="閲覧（スクロール・テキスト選択）"
                >
                    <Icons.Pan />
                    <span>閲覧</span>
                </button>
                <div className="tool-sep" />
                <button 
                    className={`tool-btn ${currentTool === 'text' ? 'active' : ''}`}
                    onClick={handleTextButtonClick}
                    title="テキストを挿入（ボタンを押すと現在ページに追加。ページ上のダブルクリックでも配置可能）"
                >
                    <Icons.Text />
                    <span>テキスト</span>
                </button>
                <button 
                    className={`tool-btn ${currentTool === 'pen' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('pen'); }}
                    title="手書きペン（自由描画）"
                >
                    <Icons.Pen />
                    <span>ペン</span>
                </button>
                <button 
                    className={`tool-btn ${currentTool === 'highlight' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('highlight'); }}
                    title="ハイライト（蛍光マーカー）"
                >
                    <Icons.Highlight />
                    <span>ハイライト</span>
                </button>
                <button 
                    className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('eraser'); }}
                    title="消しゴム（ドラッグまたはクリックで消去）"
                >
                    <Icons.Eraser />
                    <span>消しゴム</span>
                </button>
            </div>

            <div className="tool-sep" />

            {/* テキストツールのプロパティ（テキスト選択中、またはテキストツール選択時） */}
            {(currentTool === 'text' || isTextSelected) && (
                <div className="tool-properties" onClick={e => e.stopPropagation()}>
                    <span className="prop-label">サイズ</span>
                    <select 
                        className="prop-select"
                        value={currentFontSize} 
                        onChange={handleTextSizeChange}
                    >
                        {FONT_SIZES.map(sz => (
                            <option key={sz} value={sz}>{sz}px</option>
                        ))}
                    </select>

                    <span className="prop-label">色</span>
                    <div className="color-swatches">
                        {TEXT_COLORS.map(c => (
                            <button
                                key={c.value}
                                className={`color-swatch ${currentTextColor === c.value ? 'selected' : ''}`}
                                style={{ backgroundColor: c.value }}
                                onClick={() => handleTextColorChange(c.value)}
                                title={c.label}
                                aria-label={c.label}
                            />
                        ))}
                    </div>

                    {isTextSelected && (
                        <button 
                            className="tool-btn-delete"
                            onClick={() => deleteAnnotation(selectedId)}
                            title="選択したテキストを削除"
                        >
                            <Icons.Delete />
                            <span>削除</span>
                        </button>
                    )}
                </div>
            )}

            {/* ペンツールのプロパティ（ペンの太さ・ペンの色） */}
            {currentTool === 'pen' && !isTextSelected && (
                <div className="tool-properties" onClick={e => e.stopPropagation()}>
                    <span className="prop-label">太さ</span>
                    <select 
                        className="prop-select"
                        value={penProperties.strokeWidth || 3} 
                        onChange={handlePenSizeChange}
                    >
                        {PEN_SIZES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>

                    <span className="prop-label">色</span>
                    <div className="color-swatches">
                        {PEN_COLORS.map(c => (
                            <button
                                key={c.value}
                                className={`color-swatch ${penProperties.color === c.value ? 'selected' : ''}`}
                                style={{ backgroundColor: c.value }}
                                onClick={() => handlePenColorChange(c.value)}
                                title={c.label}
                                aria-label={c.label}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ハイライトツールのプロパティ */}
            {currentTool === 'highlight' && !isTextSelected && (
                <div className="tool-properties" onClick={e => e.stopPropagation()}>
                    <span className="prop-label">太さ</span>
                    <select 
                        className="prop-select"
                        value={highlightProperties?.strokeWidth || 16} 
                        onChange={handleHighlightSizeChange}
                    >
                        {HIGHLIGHT_SIZES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>

                    <span className="prop-label">色</span>
                    <div className="color-swatches">
                        {HIGHLIGHT_COLORS.map(c => (
                            <button
                                key={c.value}
                                className={`color-swatch ${highlightProperties?.color === c.value ? 'selected' : ''}`}
                                style={{ backgroundColor: c.value }}
                                onClick={() => handleHighlightColorChange(c.value)}
                                title={c.label}
                                aria-label={c.label}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 消しゴムツールのガイド表示 */}
            {currentTool === 'eraser' && (
                <div className="tool-hint">
                    <Icons.Info />
                    <span>消したい描画や文字の上をドラッグまたはクリックして消去できます</span>
                </div>
            )}

            {/* ファイルを開く & 保存ボタン (M3 Outlined & Filled Pill Buttons) */}
            <div className="tool-save-container">
                {onOpenFile && (
                    <button 
                        type="button"
                        className="tool-btn-open"
                        onClick={(e) => { e.stopPropagation(); onOpenFile(); }}
                        title="お手持ちのPDFファイルを開く (Ctrl+O)"
                    >
                        <Icons.FolderOpen />
                        <span>ファイルを開く</span>
                    </button>
                )}
                {onSavePdf && (
                    <button 
                        type="button"
                        className="tool-btn-save"
                        onClick={(e) => { e.stopPropagation(); onSavePdf(); }}
                        disabled={isSaving}
                        title="ハイライトやテキスト注釈をPDFファイルに埋め込んで保存・ダウンロード"
                    >
                        <Icons.Save />
                        <span>{isSaving ? '保存中...' : 'PDFを保存'}</span>
                    </button>
                )}
            </div>
        </header>
    );
}
