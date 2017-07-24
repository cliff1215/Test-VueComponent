//
// Dicom Image Information
//
class DicomImageInfo {
    constructor() {
        this.bIsImageLoaded = false;
        this.nWidth = 0;
        this.nHeight = 0;
        this.nWinWidth = 0;
        this.nWinCenter = 0;
        this.dSlope = 1.0;
        this.dIntercept = 0.0;
        this.nMinPixVal = 0;
        this.nPixelRep = 0;
        this.dZoomRatio = 1.0;

        this.pRGBAImg = null; // ArrayBuffer
    }

    static _base64ToArrayBuffer(base64) {
        let binary_string =  window.atob(base64);
        let len = binary_string.length;
        let bytes = new Uint8Array( len );
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }

    setMinPixelValue(pRawBuf) {
        let len = pRawBuf.length;
        for (let i = 0; i < len; ++i) {
            if (pRawBuf[i] < this.nMinPixVal)
                this.nMinPixVal = pRawBuf[i];
        }
    }

    setFromJson(dcmJson) {
        this.nWidth = dcmJson["00280011"].Value[0];
        this.nHeight = dcmJson["00280010"].Value[0];
        this.nWinWidth = dcmJson["00281051"].Value[0];
        this.nWinCenter = dcmJson["00281050"].Value[0];
        this.dSlope = dcmJson["00281053"] ? dcmJson["00281053"].Value[0] : 1.0;
        this.dIntercept = dcmJson["00281052"] ? dcmJson["00281052"].Value[0] : 0.0;
        this.nPixelRep = dcmJson["00280103"] ? dcmJson["00280103"].Value[0] : 0;

        this.loadImage(dcmJson["7FE00010"].InlineBinary);
    }

    loadImage(base64) {
        let buffer = DicomImageInfo._base64ToArrayBuffer(base64);
        let pRawBuf = new Int16Array(buffer);
        if (this.nPixelRep === 1) {
            this.setMinPixelValue(pRawBuf);
        }
        this.bIsImageLoaded = this.setRGBAImg(pRawBuf);
    }

    setRGBAImg (rawImg) {
        if (this.nWidth === 0 || this.nHeight === 0) {
            return false;
        }

        let base, start, x, y;
    
        this.pRGBAImg = new Uint8Array(this.nWidth * 4 * this.nHeight);
        for (y = 0; y < this.nHeight; y++) {
            for (x = 0; x < this.nWidth; x++) {
                base = y * this.nWidth + x;
                start = base * 4;

                if (this.nMinPixVal < 0) {
                    rawImg[base] += this.nMinPixVal * -1;
                }
                this.pRGBAImg[start + 0] = rawImg[base] & 0x00ff;
                this.pRGBAImg[start + 1] = (rawImg[base] >> 8);
                this.pRGBAImg[start + 2] = 0;
                this.pRGBAImg[start + 3] = 255;
            }
        }
        this.dIntercept += this.nMinPixVal < 0 ? this.nMinPixVal : 0;
        return true;
    }

    getLowUpVal() {
        if (!this.bIsImageLoaded) {
            return null;
        }
        
        let winCen = (this.nWinCenter - this.dIntercept) / this.dSlope;
        let dbHalf = (this.nWinWidth / this.dSlope) / 2.0;
        return {
            lower: Math.floor(winCen - dbHalf),
            upper: Math.floor(winCen + dbHalf)
        };
    }

    getCurrScaleX() {
        return (this.nHeight > this.nWidth
                ? 2.0 * this.nWidth / this.nHeight
                : 2.0) * this.dZoomRatio;
    }

    getCurrScaleY() {
        return (this.nWidth > this.nHeight
                ? 2.0 * this.nHeight / this.nWidth
                : 2.0) * this.dZoomRatio;
    }

    changeWinWidth(difference) {
        this.nWinWidth += difference;
        if (this.nWinWidth < 0) 
            this.nWinWidth = 0;
    }

    changeWinCenter(difference) {
        this.nWinCenter += difference;
    }

    changeZoomRatio(difference) {
        this.dZoomRatio += difference;
        if (difference < 0 && this.dZoomRatio < 1.0)
            this.dZoomRatio = 1.0;
    }
}

export default DicomImageInfo;