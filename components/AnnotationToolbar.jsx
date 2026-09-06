import React, { useContext } from 'react';
import { AnnotationContext } from '../contexts/AnnotationContext';
import './AnnotationToolbar.css';

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
        <div className="annotation-toolbar">
            <div className="tool-group">
                <button 
                    className={`tool-btn ${currentTool === 'view' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('view'); }}
                    title="閲覧（スクロール・テキスト選択）"
                >
                    <span className="btn-icon">🖐️</span>
                    <span>閲覧</span>
                </button>
                <div className="tool-sep" />
                <button 
                    className={`tool-btn ${currentTool === 'text' ? 'active' : ''}`}
                    onClick={handleTextButtonClick}
                    title="テキストを挿入（ボタンを押すと現在ページに追加。ページ上のダブルクリックでも配置可能）"
                >
                    <span className="btn-icon">🔤</span>
                    <span>テキスト</span>
                </button>
                <button 
                    className={`tool-btn ${currentTool === 'pen' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('pen'); }}
                    title="手書きペン（自由描画）"
                >
                    <span className="btn-icon">✏️</span>
                    <span>ペン</span>
                </button>
                <button 
                    className={`tool-btn ${currentTool === 'highlight' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('highlight'); }}
                    title="ハイライト（蛍光マーカー）"
                >
                    <span className="btn-icon">🖍️</span>
                    <span>ハイライト</span>
                </button>
                <button 
                    className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTool('eraser'); }}
                    title="消しゴム（ドラッグまたはクリックで消去）"
                >
                    <span className="btn-icon">🧹</span>
                    <span>消しゴム</span>
                </button>
            </div>

            <div className="tool-sep" />

            {/* テキストツールのプロパティ（テキスト選択中、またはテキストツール選択時） */}
            {(currentTool === 'text' || isTextSelected) && (
                <div className="tool-properties" onClick={e => e.stopPropagation()}>
                    <span className="prop-label">サイズ:</span>
                    <select 
                        className="prop-select"
                        value={currentFontSize} 
                        onChange={handleTextSizeChange}
                    >
                        {FONT_SIZES.map(sz => (
                            <option key={sz} value={sz}>{sz}px</option>
                        ))}
                    </select>

                    <span className="prop-label">色:</span>
                    <div className="color-swatches">
                        {TEXT_COLORS.map(c => (
                            <button
                                key={c.value}
                                className={`color-swatch ${currentTextColor === c.value ? 'selected' : ''}`}
                                style={{ backgroundColor: c.value }}
                                onClick={() => handleTextColorChange(c.value)}
                                title={c.label}
                            />
                        ))}
                    </div>

                    {isTextSelected && (
                        <button 
                            className="tool-btn-delete"
                            onClick={() => deleteAnnotation(selectedId)}
                            title="選択したテキストを削除"
                        >
                            🗑️ 削除
                        </button>
                    )}
                </div>
            )}

            {/* ペンツールのプロパティ（ペンの太さ・ペンの色） */}
            {currentTool === 'pen' && !isTextSelected && (
                <div className="tool-properties" onClick={e => e.stopPropagation()}>
                    <span className="prop-label">サイズ(太さ):</span>
                    <select 
                        className="prop-select"
                        value={penProperties.strokeWidth || 3} 
                        onChange={handlePenSizeChange}
                    >
                        {PEN_SIZES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>

                    <span className="prop-label">色:</span>
                    <div className="color-swatches">
                        {PEN_COLORS.map(c => (
                            <button
                                key={c.value}
                                className={`color-swatch ${penProperties.color === c.value ? 'selected' : ''}`}
                                style={{ backgroundColor: c.value }}
                                onClick={() => handlePenColorChange(c.value)}
                                title={c.label}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ハイライトツールのプロパティ */}
            {currentTool === 'highlight' && !isTextSelected && (
                <div className="tool-properties" onClick={e => e.stopPropagation()}>
                    <span className="prop-label">太さ:</span>
                    <select 
                        className="prop-select"
                        value={highlightProperties?.strokeWidth || 16} 
                        onChange={handleHighlightSizeChange}
                    >
                        {HIGHLIGHT_SIZES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>

                    <span className="prop-label">色:</span>
                    <div className="color-swatches">
                        {HIGHLIGHT_COLORS.map(c => (
                            <button
                                key={c.value}
                                className={`color-swatch ${highlightProperties?.color === c.value ? 'selected' : ''}`}
                                style={{ backgroundColor: c.value }}
                                onClick={() => handleHighlightColorChange(c.value)}
                                title={c.label}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 消しゴムツールのガイド表示 */}
            {currentTool === 'eraser' && (
                <div className="tool-hint">
                    <span>💡 消したい描画や文字の上をドラッグまたはクリックして消去できます</span>
                </div>
            )}

            {/* ファイルを開く & 保存ボタン */}
            <div className="tool-save-container">
                {onOpenFile && (
                    <button 
                        type="button"
                        className="tool-btn-open"
                        onClick={(e) => { e.stopPropagation(); onOpenFile(); }}
                        title="お手持ちのPDFファイルを開く (Ctrl+O)"
                    >
                        <span className="btn-icon">📁</span>
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
                        <span className="btn-icon">💾</span>
                        <span>{isSaving ? '保存中...' : 'PDFを保存 (DL)'}</span>
                    </button>
                )}
            </div>
        </div>
    );
}
