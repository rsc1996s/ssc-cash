import { useRef, useState, useEffect } from "react";

// รับลายเซ็นด้วยนิ้ว/เมาส์บน canvas แล้วส่งออกเป็น base64 data URL ให้ component แม่ (เก็บลง Firestore โดยตรง)
export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1B2A38";
  }, []);

  function pos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: (point.clientX - rect.left) * (canvas.width / rect.width),
      y: (point.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    // ส่งออกเป็น base64 data URL โดยตรง (ไม่ต้องอัปโหลดขึ้น Storage)
    onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        className="w-full border border-paperLine rounded bg-white touch-none"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex justify-between items-center mt-1">
        <span className="text-xs text-inkSoft">ลงลายเซ็นในกรอบด้านบนเพื่อยืนยันการอนุมัติ</span>
        <button type="button" onClick={clear} className="text-xs text-rust">
          ล้างลายเซ็น
        </button>
      </div>
      {!hasSignature && <p className="text-xs text-amber mt-1">ยังไม่ได้เซ็น</p>}
    </div>
  );
}
