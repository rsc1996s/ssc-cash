// บีบอัดรูปฝั่ง client แล้วแปลงเป็น base64 data URL เพื่อเก็บลง Firestore โดยตรง
// ใช้แทน Firebase Storage ทั้งหมด เพราะ Storage ต้องอัปเกรดเป็นแพ็กเสียเงิน (Blaze) ตั้งแต่ ก.พ. 2026
// Firestore เอกสารเดียวจำกัดที่ 1MB ฉะนั้นต้องบีบให้เล็กพอ (เป้าหมาย < ~180KB ต่อรูป)

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function drawToCanvas(img, maxDim) {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // พื้นขาวรองก่อน กันกรณีรูปต้นฉบับมีพื้นโปร่งใส (เช่น PNG) แล้วกลายเป็นดำตอนแปลงเป็น JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function approxBytesFromDataUrl(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.round((base64.length * 3) / 4);
}

/**
 * แปลงไฟล์รูปเป็น JPEG data URL ที่ย่อขนาดและบีบคุณภาพจนอยู่ใต้ maxBytes
 */
export async function fileToCompressedDataUrl(file, { maxDim = 1000, maxBytes = 180000 } = {}) {
  const img = await loadImage(file);
  const canvas = drawToCanvas(img, maxDim);
  let quality = 0.7;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (approxBytesFromDataUrl(out) > maxBytes && quality > 0.25) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

export function approxKb(dataUrl) {
  if (!dataUrl) return 0;
  return Math.round(approxBytesFromDataUrl(dataUrl) / 1024);
}
