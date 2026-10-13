import React, { useRef } from 'react';
import './PrintPreviewModal.css';

const Icons = {
    Print: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
        </svg>
    ),
    OpenInNew: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
    ),
    Close: () => (
        <svg className="m3-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
    )
};

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
        <div className="print-preview-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="print-dialog-title">
            <div className="print-preview-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="print-preview-header">
                    <div className="print-preview-title" id="print-dialog-title">
                        <Icons.Print />
                        <span>印刷プレビュー（変更後のPDF）</span>
                    </div>
                    <div className="print-preview-actions">
                        <button 
                            type="button" 
                            className="print-btn-primary" 
                            onClick={handlePrint}
                            title="ブラウザの印刷ダイアログを開いて印刷"
                        >
                            <Icons.Print />
                            <span>印刷を実行</span>
                        </button>
                        <button 
                            type="button" 
                            className="print-btn-secondary" 
                            onClick={handleOpenTab}
                            title="別タブで大きく表示"
                        >
                            <Icons.OpenInNew />
                            <span>別タブで開く</span>
                        </button>
                        <button 
                            type="button" 
                            className="print-btn-close" 
                            onClick={onClose}
                            title="閉じる"
                            aria-label="閉じる"
                        >
                            <Icons.Close />
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
