import React, { useRef } from 'react';
import './PrintPreviewModal.css';

export function PrintPreviewModal({ blobUrl, onClose }) {
    const iframeRef = useRef(null);

    const handlePrint = () => {
        if (iframeRef.current) {
            try {
                iframeRef.current.contentWindow.focus();
                iframeRef.current.contentWindow.print();
            } catch (e) {
                console.warn('Iframe print failed, falling back to window.open', e);
                window.open(blobUrl, '_blank')?.print();
            }
        }
    };

    const handleOpenTab = () => {
        window.open(blobUrl, '_blank');
    };

    return (
        <div className="print-preview-overlay" onClick={onClose}>
            <div className="print-preview-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="print-preview-header">
                    <div className="print-preview-title">
                        <span className="print-preview-icon">🖨️</span>
                        <span>印刷プレビュー（変更後のPDF）</span>
                    </div>
                    <div className="print-preview-actions">
                        <button 
                            type="button" 
                            className="print-btn-primary" 
                            onClick={handlePrint}
                            title="ブラウザの印刷ダイアログを開いて印刷"
                        >
                            🖨️ 印刷を実行
                        </button>
                        <button 
                            type="button" 
                            className="print-btn-secondary" 
                            onClick={handleOpenTab}
                            title="別タブで大きく表示"
                        >
                            ↗ 別タブで開く
                        </button>
                        <button 
                            type="button" 
                            className="print-btn-close" 
                            onClick={onClose}
                            title="閉じる"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="print-preview-body">
                    <iframe
                        ref={iframeRef}
                        src={`${blobUrl}#toolbar=0&navpanes=0`}
                        title="PDF印刷プレビュー"
                        className="print-preview-iframe"
                    />
                </div>
            </div>
        </div>
    );
}
