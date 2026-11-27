export default function ReceiptPhotoFields({ photos, addPhoto, removePhoto, compressing, photoError }) {
  return (
    <div>
      {photos.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={index} className="relative min-w-0">
              <img src={photo.dataUrl} alt={`หลักฐาน ${index + 1}`} className="h-24 w-full rounded-lg border border-paperLine object-cover" />
              <button type="button" aria-label={`ลบรูปหลักฐาน ${index + 1}`} onClick={() => removePhoto(index)} className="absolute right-1 top-1 rounded-full border border-paperLine bg-white px-2 text-red-600">×</button>
              <div className="mt-1 text-center text-xs text-inkSoft">~{photo.kb} KB</div>
            </div>
          ))}
        </div>
      )}
      {photos.length < 3 && (
        <input type="file" accept="image/*" capture="environment" disabled={compressing}
          aria-label="ถ่ายหรือเลือกรูปหลักฐาน" className="w-full rounded-lg border border-paperLine bg-blue-50 p-3 text-sm"
          onChange={(event) => { addPhoto(event.target.files?.[0]); event.target.value = ""; }} />
      )}
      <p className="mt-1 text-xs text-inkSoft">แนบได้สูงสุด 3 รูป ({photos.length}/3)</p>
      {photoError && <p role="alert" className="mt-2 text-sm text-danger">{photoError}</p>}
    </div>
  );
}
