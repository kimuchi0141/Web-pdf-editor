import React, { useContext, useRef, useState, useEffect, useCallback } from 'react';
import { AnnotationContext } from '../contexts/AnnotationContext';
import './AnnotationLayer.css';

function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        return Math.hypot(px - ax, py - ay);
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isNearPath(points, px, py, threshold) {
    if (!points || points.length === 0) return false;
    if (points.length === 1) {
        return Math.hypot(points[0].x - px, points[0].y - py) <= threshold;
    }
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (distanceToSegment(px, py, a.x, a.y, b.x, b.y) <= threshold) {
            return true;
        }
    }
    return false;
}

function isNearText(ann, px, py, threshold) {
    const w = Math.max(60, (ann.text?.length || 4) * (ann.fontSize || 16) * 0.9);
    const h = (ann.fontSize || 16) * 1.6;
    return (
        px >= ann.x - threshold &&
        px <= ann.x + w + threshold &&
        py >= ann.y - threshold &&
        py <= ann.y + h + threshold
    );
}

export function AnnotationLayer({ pageIndex, scale, rotation }) {
    const { 
        currentTool, annotations, addAnnotation, updateAnnotation, 
        selectedId, setSelectedId, deleteAnnotations, deleteAnnotation,
        createTextAnnotation, commitTextAnnotation,
        textProperties, penProperties, highlightProperties, clearSelection
    } = useContext(AnnotationContext);

    const layerRef = useRef(null);
    
    // フリーハンド描画（ペン・ハイライト）
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState(null);

    // 消しゴム操作
    const [isErasing, setIsErasing] = useState(false);

    // このページの全アノテーション
    const pageAnnotations = annotations.filter(a => a.pageIndex === pageIndex);

    const getMouseCoords = useCallback((e) => {
        if (!layerRef.current) return { x: 0, y: 0 };
        const rect = layerRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale
        };
    }, [scale]);

    // 消しゴム判定処理（ドラッグ・クリック両対応）
    const eraseAt = useCallback((px, py) => {
        const threshold = 18 / scale;
        const toDelete = [];

        pageAnnotations.forEach(ann => {
            if (ann.type === 'path' || ann.type === 'highlight') {
                if (isNearPath(ann.points, px, py, threshold)) {
                    toDelete.push(ann.id);
                }
            } else if (ann.type === 'text') {
                if (isNearText(ann, px, py, threshold)) {
                    toDelete.push(ann.id);
                }
            }
        });

        if (toDelete.length > 0) {
            deleteAnnotations(toDelete);
        }
    }, [pageAnnotations, scale, deleteAnnotations]);

    // キーボードによる選択テキスト削除（Delete/Backspace）
    // Bug-9修正: このページのアノテーションが選択されている場合のみ処理する
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedId) return;
            // 入力中（INPUT, TEXTAREA）はテキスト編集を優先
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
            // このページのアノテーションでなければスキップ（他ページのリスナーが処理する）
            if (!pageAnnotations.some(a => a.id === selectedId)) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteAnnotation(selectedId);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, deleteAnnotation, pageAnnotations]);

    const handlePointerDown = (e) => {
        if (currentTool === 'view') return;

        const { x, y } = getMouseCoords(e);

        if (currentTool === 'eraser') {
            setIsErasing(true);
            eraseAt(x, y);
            return;
        }

        // テキストツール: キャンバスの背景をクリックした場合は選択を解除（新規作成はダブルクリック）
        if (currentTool === 'text') {
            if (selectedId) {
                clearSelection();
            }
            return;
        }

        // ペン・ハイライト等で背景をクリックした場合は選択状態を解除
        if (selectedId) {
            clearSelection();
        }

        // ペン・ハイライトの処理
        if (currentTool === 'pen') {
            setIsDrawing(true);
            setCurrentPath({
                id: Date.now(),
                pageIndex,
                type: 'path',
                points: [{ x, y }],
                strokeWidth: penProperties.strokeWidth,
                color: penProperties.color
            });
        } else if (currentTool === 'highlight') {
            setIsDrawing(true);
            setCurrentPath({
                id: Date.now(),
                pageIndex,
                type: 'highlight',
                points: [{ x, y }],
                strokeWidth: highlightProperties?.strokeWidth || 16,
                color: highlightProperties?.color || 'rgba(255, 226, 0, 0.45)'
            });
        }
    };

    const handlePointerMove = (e) => {
        if (currentTool === 'view') return;
        const { x, y } = getMouseCoords(e);

        if (currentTool === 'eraser' && isErasing) {
            eraseAt(x, y);
            return;
        }

        if (isDrawing && currentPath) {
            setCurrentPath(prev => ({
                ...prev,
                points: [...prev.points, { x, y }]
            }));
        }
    };

    const handlePointerUp = () => {
        if (isDrawing && currentPath) {
            if (currentPath.points.length > 0) {
                addAnnotation(currentPath);
            }
        }
        setIsDrawing(false);
        setCurrentPath(null);
        setIsErasing(false);
    };

    const handleDoubleClick = (e) => {
        if (currentTool === 'text') {
            const { x, y } = getMouseCoords(e);
            createTextAnnotation({
                pageIndex,
                x,
                y,
                fontSize: textProperties.fontSize,
                color: textProperties.color
            });
        }
    };

    const layerCursor = 
        currentTool === 'text' ? 'crosshair' :
        currentTool === 'pen' || currentTool === 'highlight' ? 'crosshair' :
        currentTool === 'eraser' ? 'pointer' : 'default';

    return (
        <div 
            ref={layerRef}
            className={`annotation-layer tool-${currentTool}`}
            style={{
                pointerEvents: currentTool === 'view' ? 'none' : 'auto',
                cursor: layerCursor
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onDoubleClick={handleDoubleClick}
        >
            {/* SVG描画レイヤー（手書き・ハイライト） */}
            <svg className="ann-svg-layer">
                {pageAnnotations.filter(a => a.type === 'path' || a.type === 'highlight').map(ann => (
                    <AnnotationPath 
                        key={ann.id} 
                        annotation={ann} 
                        scale={scale} 
                        currentTool={currentTool}
                        onErase={() => deleteAnnotation(ann.id)}
                    />
                ))}
                
                {/* 描画中の線プレビュー */}
                {currentPath && (
                    <AnnotationPath annotation={currentPath} scale={scale} isCurrent={true} />
                )}
            </svg>

            {/* テキストボックスレイヤー */}
            {pageAnnotations.filter(a => a.type === 'text').map(ann => (
                <AnnotationText 
                    key={ann.id} 
                    annotation={ann} 
                    scale={scale}
                    currentTool={currentTool}
                    isSelected={selectedId === ann.id}
                    onSelect={() => setSelectedId(ann.id)}
                    onUpdate={(updates) => updateAnnotation(ann.id, updates)}
                    onCommit={(text) => commitTextAnnotation(ann.id, text)}
                    onDelete={() => deleteAnnotation(ann.id)}
                />
            ))}
        </div>
    );
}

function AnnotationPath({ annotation, scale, isCurrent = false, currentTool, onErase }) {
    if (!annotation.points || annotation.points.length === 0) return null;
    
    const d = annotation.points.map((p, i) => 
        (i === 0 ? 'M' : 'L') + ` ${(p.x * scale).toFixed(1)} ${(p.y * scale).toFixed(1)}`
    ).join(' ');

    const handlePointerDown = (e) => {
        if (currentTool === 'eraser' && !isCurrent) {
            e.stopPropagation();
            onErase?.();
        }
    };

    return (
        <path
            d={d}
            fill="none"
            stroke={annotation.color}
            strokeWidth={annotation.strokeWidth * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ 
                pointerEvents: currentTool === 'eraser' ? 'stroke' : 'none',
                cursor: currentTool === 'eraser' ? 'pointer' : 'inherit'
            }}
            onPointerDown={handlePointerDown}
        />
    );
}

function AnnotationText({ 
    annotation, scale, currentTool, isSelected, 
    onSelect, onUpdate, onCommit, onDelete 
}) {
    const isEditing = Boolean(annotation.isEditing);
    const [textValue, setTextValue] = useState(annotation.text || '');
    const inputRef = useRef(null);
    const isComposingRef = useRef(false);
    // Bug-10修正: ドラッグリスナーの参照を保持し、アンマウント時に確実にクリーンアップ
    const dragListenersRef = useRef(null);

    // アンマウント時にドラッグリスナーをクリーンアップ
    useEffect(() => {
        return () => {
            if (dragListenersRef.current) {
                window.removeEventListener('pointermove', dragListenersRef.current.onMove);
                window.removeEventListener('pointerup', dragListenersRef.current.onUp);
                dragListenersRef.current = null;
            }
        };
    }, []);

    // 編集モードになったら自動フォーカス
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // 外部からのテキスト更新を同期
    useEffect(() => {
        setTextValue(annotation.text || '');
    }, [annotation.text]);

    // 確定処理：入力されたテキストで確定し、反映状態に切り替える
    const handleConfirm = useCallback(() => {
        onCommit(textValue);
    }, [textValue, onCommit]);

    // フォーカスが外れた場合（blur）も自動確定
    const handleBlur = (e) => {
        if (e.relatedTarget && e.relatedTarget.closest('.ann-text-actions')) {
            return;
        }
        handleConfirm();
    };

    // キー入力処理
    const handleKeyDown = (e) => {
        // 日本語IMEの変換中（文字変換確定のEnter）はコミットしない
        if (isComposingRef.current || e.nativeEvent?.isComposing) {
            return;
        }
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            // Bug-2修正: blur()のみ呼ぶ。blurイベントがhandleBlur→handleConfirmを呼ぶため、
            // ここでhandleConfirmを直接呼ぶと二重コミットになる
            inputRef.current?.blur();
        }
    };

    // ドラッグ移動処理：追加済みのテキストボックスを直接掴んで移動可能にする
    const handlePointerDown = (e) => {
        if (currentTool === 'view') return;
        if (currentTool === 'eraser') {
            e.stopPropagation();
            onDelete();
            return;
        }

        // 編集中（inputに入力中）のクリックはイベントを消費し、親レイヤーでの新規作成を防ぐ
        if (isEditing) {
            e.stopPropagation();
            return;
        }

        e.stopPropagation();

        // 追加済みのテキストボックスをクリックした場合、即座に選択状態にしてドラッグ移動を開始
        onSelect();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const origX = annotation.x;
        const origY = annotation.y;

        const onMove = (moveEvt) => {
            const deltaX = (moveEvt.clientX - startClientX) / scale;
            const deltaY = (moveEvt.clientY - startClientY) / scale;
            onUpdate({
                x: Math.max(0, Math.round(origX + deltaX)),
                y: Math.max(0, Math.round(origY + deltaY))
            });
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            dragListenersRef.current = null;
        };

        // 既存のリスナーがあればクリーンアップ
        if (dragListenersRef.current) {
            window.removeEventListener('pointermove', dragListenersRef.current.onMove);
            window.removeEventListener('pointerup', dragListenersRef.current.onUp);
        }

        dragListenersRef.current = { onMove, onUp };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return (
        <div 
            className={`ann-text-box ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
            style={{
                left: annotation.x * scale,
                top: annotation.y * scale,
                fontSize: annotation.fontSize * scale,
                color: annotation.color,
                pointerEvents: currentTool === 'view' ? 'none' : 'auto'
            }}
            onPointerDown={handlePointerDown}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onUpdate({ isEditing: true });
            }}
        >
            {isEditing ? (
                <>
                    {/* 入力中の確定・削除アクションバー */}
                    <div 
                        className="ann-text-actions"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            type="button"
                            className="ann-btn-confirm"
                            onClick={(e) => {
                                e.stopPropagation();
                                inputRef.current?.blur();
                                handleConfirm();
                            }}
                            title="テキストを確定して反映 (Enter)"
                        >
                            ✓ 完了 (Enter)
                        </button>
                        <button 
                            type="button"
                            className="ann-btn-delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            title="削除"
                        >
                            ✕
                        </button>
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        className="ann-text-input"
                        value={textValue}
                        placeholder="テキストを入力"
                        onChange={(e) => {
                            setTextValue(e.target.value);
                            onUpdate({ text: e.target.value });
                        }}
                        onCompositionStart={() => { isComposingRef.current = true; }}
                        onCompositionEnd={() => { isComposingRef.current = false; }}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        style={{
                            fontSize: annotation.fontSize * scale,
                            color: annotation.color
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    />
                </>
            ) : (
                /* 反映状態（確定テキスト表示） */
                <>
                    {isSelected && (
                        <div 
                            className="ann-text-actions"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button 
                                type="button"
                                className="ann-btn-edit"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate({ isEditing: true });
                                }}
                                title="テキストを編集 (ダブルクリックでも可)"
                            >
                                ✎ 編集
                            </button>
                            <button 
                                type="button"
                                className="ann-btn-delete"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                title="テキストを削除"
                            >
                                🗑 削除
                            </button>
                        </div>
                    )}

                    <div className="ann-text-content" title="ドラッグして移動 / ダブルクリックで編集">
                        <span>{annotation.text}</span>
                        {isSelected && (
                            <div className="ann-drag-badge" title="ドラッグで移動">
                                ✥
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
