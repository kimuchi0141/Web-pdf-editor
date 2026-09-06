import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AnnotationContext = createContext();

// Bug-1修正: グローバルカウンタによるユニークID生成（Date.now()+randomのID衝突を防止）
let _nextAnnotationId = Date.now();
const generateId = () => ++_nextAnnotationId;

export function AnnotationProvider({ children }) {
    // ツール: 'view', 'text', 'pen', 'highlight', 'eraser'
    const [currentTool, setCurrentTool] = useState('view');
    // 選択中のアノテーションID
    const [selectedId, setSelectedId] = useState(null);

    // アノテーションリスト（ペン線、フリーハンドハイライト、テキストボックス）
    const [annotations, setAnnotations] = useState(() => {
        try {
            const saved = sessionStorage.getItem('pdf_annotations');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // 古いプレースホルダーデータや空文字データをクリーンアップ
                    return parsed
                        .filter(a => a.type !== 'text' || (a.text && a.text.trim() !== '' && a.text !== 'ここに入力'))
                        .map(a => a.isEditing ? { ...a, isEditing: false } : a);
                }
            }
        } catch (e) {}
        return [];
    });

    // テキスト選択ハイライトリスト（@react-pdf-viewer/highlight による文字選択ハイライト）
    const [textHighlights, setTextHighlights] = useState(() => {
        try {
            const saved = sessionStorage.getItem('pdf_text_highlights');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        return [];
    });

    useEffect(() => {
        try {
            sessionStorage.setItem('pdf_annotations', JSON.stringify(annotations));
        } catch (e) {}
    }, [annotations]);

    useEffect(() => {
        try {
            sessionStorage.setItem('pdf_text_highlights', JSON.stringify(textHighlights));
        } catch (e) {}
    }, [textHighlights]);

    // 現在表示中のページ番号（0-indexed）
    const [currentPage, setCurrentPage] = useState(0);

    // テキスト設定
    const [textProperties, setTextProperties] = useState({ fontSize: 16, color: '#dc2626' });
    // ペン設定
    const [penProperties, setPenProperties] = useState({ strokeWidth: 3, color: '#2563eb' });
    // ハイライト設定
    const [highlightProperties, setHighlightProperties] = useState({ strokeWidth: 16, color: 'rgba(255, 226, 0, 0.45)' });

    // 選択状態の解除（空のテキストボックスの自動削除 & 編集モード解除）
    const clearSelection = useCallback(() => {
        setSelectedId(null);
        setAnnotations(prev => 
            prev
                .filter(a => a.type !== 'text' || (a.text && a.text.trim() !== ''))
                .map(a => a.isEditing ? { ...a, isEditing: false } : a)
        );
    }, []);

    // ツール変更時、選択状態を完全に解除する
    const handleToolChange = useCallback((tool) => {
        setCurrentTool(tool);
        clearSelection();
    }, [clearSelection]);

    // 任意座標へのテキスト注釈作成
    const createTextAnnotation = useCallback(({ pageIndex, x, y, fontSize, color }) => {
        const newId = generateId();
        setAnnotations(prev => [
            // Bug-4修正: 既存テキストの空チェックは行わず、編集中テキストの確定のみ行う
            // 空テキストの除去はblur→commitTextAnnotationに委任
            ...prev.map(a => a.isEditing ? { ...a, isEditing: false } : a),
            {
                id: newId,
                pageIndex: typeof pageIndex === 'number' ? pageIndex : 0,
                type: 'text',
                x: Math.round(x || 60),
                y: Math.round(y || 140),
                text: '',
                fontSize: fontSize || 16,
                color: color || '#dc2626',
                isEditing: true
            }
        ]);
        setSelectedId(newId);
        setCurrentTool('text');
        return newId;
    }, []);

    // ツールバーの「テキスト」ボタンを押したときに、現在表示中のページに即座にテキストを挿入する
    const addTextAtCurrentPage = useCallback((customPageIndex) => {
        const targetPage = typeof customPageIndex === 'number' ? customPageIndex : currentPage;
        // Bug-3修正: 同一ページの既存テキスト数に応じてy座標をオフセットし、重なりを防止
        const existingTextCount = annotations.filter(
            a => a.type === 'text' && a.pageIndex === targetPage
        ).length;
        const yOffset = 150 + existingTextCount * 40;
        return createTextAnnotation({
            pageIndex: targetPage,
            x: 80,
            y: yOffset,
            fontSize: textProperties.fontSize,
            color: textProperties.color
        });
    }, [currentPage, createTextAnnotation, textProperties, annotations]);

    // テキスト編集の確定（空なら削除、文字があれば確定反映＆編集モード解除）
    const commitTextAnnotation = useCallback((id, text) => {
        const trimmed = (text !== undefined && text !== null ? String(text) : '').trim();
        setAnnotations(prev => {
            if (!trimmed) {
                return prev.filter(a => a.id !== id);
            }
            return prev.map(a => a.id === id ? { ...a, text: trimmed, isEditing: false } : a);
        });
        // 確定後も選択状態を維持（ドラッグ移動やプロパティ変更を可能にする）
        setSelectedId(id);
    }, []);

    const addAnnotation = useCallback((annotation) => {
        setAnnotations(prev => [...prev, annotation]);
    }, []);

    const updateAnnotation = useCallback((id, updates) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }, []);

    const deleteAnnotation = useCallback((id) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
        setSelectedId(prev => (prev === id ? null : prev));
    }, []);

    const deleteAnnotations = useCallback((ids) => {
        if (!ids || ids.length === 0) return;
        const idSet = new Set(ids);
        setAnnotations(prev => prev.filter(a => !idSet.has(a.id)));
        setSelectedId(prev => (idSet.has(prev) ? null : prev));
    }, []);

    const addTextHighlight = useCallback((hl) => {
        setTextHighlights(prev => [...prev, hl]);
    }, []);

    const deleteTextHighlight = useCallback((id) => {
        setTextHighlights(prev => prev.filter(h => h.id !== id));
    }, []);

    // 新しいPDF読み込み時に全注釈・選択状態をリセット
    const resetAllAnnotations = useCallback(() => {
        setAnnotations([]);
        setTextHighlights([]);
        setSelectedId(null);
    }, []);

    return (
        <AnnotationContext.Provider value={{
            currentTool,
            setCurrentTool: handleToolChange,
            selectedId,
            setSelectedId,
            annotations,
            addAnnotation,
            updateAnnotation,
            deleteAnnotation,
            deleteAnnotations,
            createTextAnnotation,
            addTextAtCurrentPage,
            commitTextAnnotation,
            currentPage,
            setCurrentPage,
            textHighlights,
            addTextHighlight,
            deleteTextHighlight,
            resetAllAnnotations,
            clearSelection,
            textProperties,
            setTextProperties,
            penProperties,
            setPenProperties,
            highlightProperties,
            setHighlightProperties
        }}>
            {children}
        </AnnotationContext.Provider>
    );
}
