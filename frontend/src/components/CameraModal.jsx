import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';

const CameraModal = ({ onClose, onCaptureComplete }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [captures, setCaptures] = useState([]);
    const [stream, setStream] = useState(null);

    useEffect(() => {
        let currentStream;
        const openCamera = async () => {
            try {
                currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                setStream(currentStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = currentStream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                alert("Could not access the camera. Please ensure you have given permission.");
                onClose();
            }
        };

        openCamera();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [onClose]);

    const handleCapture = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCaptures(prev => [...prev, dataUrl]);
    };

    const handleAnalyze = () => {
        if (captures.length === 0) return;
        
        const doc = new jsPDF();
        captures.forEach((imageData, index) => {
            if (index > 0) {
                doc.addPage();
            }
            const { width, height } = doc.getImageProperties(imageData);
            const aspectRatio = width / height;
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = pdfWidth / aspectRatio;
            doc.addImage(imageData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        });

        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `capture_${Date.now()}.pdf`, { type: 'application/pdf' });
        
        onCaptureComplete(pdfFile);
        onClose();
    };

    return (
        <div className="camera-modal-overlay">
            <div className="camera-modal-content">
                <video ref={videoRef} autoPlay playsInline className="camera-feed"></video>
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                
                <div className="camera-controls">
                    <button onClick={handleCapture} className="button capture-btn">Take Picture</button>
                    <button onClick={handleAnalyze} className="button analyze-btn" disabled={captures.length === 0}>
                        Analyze ({captures.length} pages)
                    </button>
                    <button onClick={onClose} className="button close-btn">Close</button>
                </div>

                <div className="captures-preview">
                    {captures.map((src, index) => (
                        <img key={index} src={src} alt={`Capture ${index + 1}`} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CameraModal;