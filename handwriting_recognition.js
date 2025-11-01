/**
 * Handwriting Recognition Integration
 * This module provides handwriting recognition using various services:
 * - MyScript Interactive Ink (recommended for math)
 * - MathPix OCR API
 * - Canvas-based recognition (fallback)
 */

class HandwritingRecognizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.recognizer = null;
        this.service = 'manual'; // 'myscript', 'mathpix', 'manual'
    }

    /**
     * Initialize MyScript Interactive Ink SDK
     * Requires: https://webdemo.myscript.com/static/MyScript/index.js
     */
    async initMyScript(applicationKey, hmacKey) {
        if (typeof MyScript === 'undefined') {
            console.warn('MyScript SDK not loaded');
            return false;
        }

        try {
            this.recognizer = MyScript.createRecognizer({
                apiKey: applicationKey,
                hmacKey: hmacKey,
                language: 'en_US',
                description: {
                    'math': {
                        'protocolVersion': 'MATH_PROTOCOL'
                    }
                }
            });

            this.service = 'myscript';
            return true;
        } catch (error) {
            console.error('Error initializing MyScript:', error);
            return false;
        }
    }

    /**
     * Initialize MathPix OCR
     */
    async initMathPix(appId, appKey) {
        if (typeof MathJax === 'undefined') {
            console.warn('MathPix SDK not loaded');
            return false;
        }

        this.mathpixAppId = appId;
        this.mathpixAppKey = appKey;
        this.service = 'mathpix';
        return true;
    }

    /**
     * Recognize handwriting using configured service
     */
    async recognize(strokes = null) {
        if (!strokes) {
            strokes = this.getStrokesFromCanvas();
        }

        switch (this.service) {
            case 'myscript':
                return await this.recognizeMyScript(strokes);
            case 'mathpix':
                return await this.recognizeMathPix();
            default:
                return await this.recognizeManual();
        }
    }

    /**
     * Recognize using MyScript
     */
    async recognizeMyScript(strokes) {
        if (!this.recognizer) {
            return await this.recognizeManual();
        }

        try {
            const result = await this.recognizer.send({
                type: 'MATH',
                strokes: strokes
            });

            if (result && result.result && result.result.latex) {
                return {
                    latex: result.result.latex,
                    confidence: result.result.confidence || 0.8
                };
            }
        } catch (error) {
            console.error('MyScript recognition error:', error);
        }

        return await this.recognizeManual();
    }

    /**
     * Recognize using MathPix OCR
     */
    async recognizeMathPix() {
        if (!this.mathpixAppId || !this.mathpixAppKey) {
            return await this.recognizeManual();
        }

        try {
            const imageData = this.canvas.toDataURL('image/png');
            
            const response = await fetch('https://api.mathpix.com/v3/text', {
                method: 'POST',
                headers: {
                    'app_id': this.mathpixAppId,
                    'app_key': this.mathpixAppKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    src: imageData,
                    formats: ['latex_simplified']
                })
            });

            const data = await response.json();

            if (data.latex) {
                return {
                    latex: data.latex,
                    confidence: data.confidence || 0.8
                };
            }
        } catch (error) {
            console.error('MathPix recognition error:', error);
        }

        return await this.recognizeManual();
    }

    /**
     * Manual input fallback
     */
    async recognizeManual() {
        return new Promise((resolve) => {
            const latex = prompt(
                'Handwriting recognition not configured.\n\n' +
                'Please enter LaTeX code manually:\n' +
                '(For production, configure MyScript or MathPix API)',
                ''
            );

            resolve({
                latex: latex || '',
                confidence: latex ? 0.5 : 0
            });
        });
    }

    /**
     * Extract strokes from canvas
     * This is a simplified version - in production, track strokes during drawing
     */
    getStrokesFromCanvas() {
        // This would need to track strokes as the user draws
        // For now, return empty array (will use manual fallback)
        return [];
    }

    /**
     * Set up stroke tracking
     */
    setupStrokeTracking() {
        this.strokes = [];
        this.currentStroke = [];

        this.canvas.addEventListener('mousedown', (e) => {
            this.currentStroke = [];
            const point = this.getCanvasPoint(e);
            this.currentStroke.push(point);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.currentStroke.length > 0) {
                const point = this.getCanvasPoint(e);
                this.currentStroke.push(point);
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.currentStroke.length > 0) {
                this.strokes.push(this.currentStroke);
                this.currentStroke = [];
            }
        });
    }

    getCanvasPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            t: Date.now()
        };
    }

    getStrokes() {
        return this.strokes;
    }

    clearStrokes() {
        this.strokes = [];
        this.currentStroke = [];
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandwritingRecognizer;
}
