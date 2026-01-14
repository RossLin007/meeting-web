import { useRef, useState, useLayoutEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

interface PDFPreviewProps {
    url: string;
}

export function PDFPreview({ url }: PDFPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    console.log('📎 PDFPreview 组件渲染, url:', url);

    useLayoutEffect(() => {
        console.log('📎 useLayoutEffect 执行, url:', url);
        let isCancelled = false;

        async function loadPDF() {
            console.log('📎 loadPDF 开始执行');
            
            if (!url || !canvasRef.current) {
                console.log('📎 跳过: url 或 canvas 不存在', { url, canvasExists: !!canvasRef.current });
                return;
            }

            try {
                setLoading(true);
                setError(null);

                console.log('📎 开始加载 PDF:', url);
                const loadingTask = pdfjsLib.getDocument({
                    url: url,
                    enableXfa: false,
                });
                console.log('📎 loadingTask created');
                
                const pdf = await loadingTask.promise;
                console.log('📎 PDF 文档加载完成');

                if (isCancelled) return;

                console.log('📎 PDF 加载成功，总页数:', pdf.numPages);
                setNumPages(pdf.numPages);
                await renderPage(pdf, currentPage);
                setLoading(false);
            } catch (err: any) {
                console.error('📎 PDF 加载失败:', err);
                setError(`加载失败: ${err.message || '未知错误'}`);
                setLoading(false);
            }
        }

        async function renderPage(pdf: any, pageNum: number) {
            console.log('📎 renderPage, pageNum:', pageNum);
            if (!canvasRef.current) {
                console.log('📎 canvas 不存在');
                return;
            }

            try {
                const page = await pdf.getPage(pageNum);
                console.log('📎 页面获取成功');
                
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) {
                    console.log('📎 canvas context 不存在');
                    return;
                }

                const viewport = page.getViewport({ scale: 1.5 });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                }).promise;

                console.log(`📎 第 ${pageNum} 页渲染完成`);
            } catch (err) {
                console.error('📎 页面渲染失败:', err);
            }
        }

        // 使用 setTimeout 延迟执行，确保 DOM 完全渲染
        const timer = setTimeout(() => {
            loadPDF();
        }, 200);

        return () => {
            console.log('📎 useLayoutEffect 清理');
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [url, currentPage]);

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, numPages));
    };

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                height: '70vh',
                color: 'var(--color-text-secondary, #666)',
                gap: '16px'
            }}>
                <div>加载中... (请查看控制台日志)</div>
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)', fontSize: '14px' }}
                >
                    直接下载 PDF
                </a>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                height: '70vh',
                color: 'var(--color-text-secondary, #666)',
                gap: '8px'
            }}>
                <span>{error}</span>
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)' }}
                >
                    在新窗口打开
                </a>
            </div>
        );
    }

    return (
        <div style={{ 
            width: '100%', 
            height: '70vh', 
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* 分页控制 */}
            {numPages > 1 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '8px',
                    backgroundColor: 'var(--color-bg-page, #f5f5f5)',
                    borderBottom: '1px solid rgba(0,0,0,0.1)'
                }}>
                    <button 
                        onClick={handlePrevPage}
                        disabled={currentPage <= 1}
                        style={{
                            padding: '4px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: currentPage <= 1 ? '#ccc' : 'var(--color-primary)',
                            color: 'white',
                            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        上一页
                    </button>
                    <span style={{ fontSize: '14px' }}>
                        {currentPage} / {numPages}
                    </span>
                    <button 
                        onClick={handleNextPage}
                        disabled={currentPage >= numPages}
                        style={{
                            padding: '4px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: currentPage >= numPages ? '#ccc' : 'var(--color-primary)',
                            color: 'white',
                            cursor: currentPage >= numPages ? 'not-allowed' : 'pointer'
                        }}
                    >
                        下一页
                    </button>
                </div>
            )}

            {/* PDF 画布 */}
            <div style={{ 
                flex: 1,
                display: 'flex', 
                justifyContent: 'center',
                padding: '16px',
                overflow: 'auto'
            }}>
                <canvas 
                    ref={canvasRef} 
                    style={{ 
                        maxWidth: '100%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                />
            </div>
        </div>
    );
}

export default PDFPreview;
