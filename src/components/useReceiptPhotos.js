import { useState } from "react";
import { fileToCompressedDataUrl, approxKb } from "../lib/image";

export default function useReceiptPhotos() {
  const [photos, setPhotos] = useState([]);
  const [compressing, setCompressing] = useState(false);
  const [photoError, setPhotoError] = useState("");

  async function addPhoto(file) {
    if (!file || compressing) return;
    if (photos.length >= 3) {
      setPhotoError("แนบรูปหลักฐานได้สูงสุด 3 รูป");
      return;
    }
    setCompressing(true);
    setPhotoError("");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      if (dataUrl.length > 175000) {
        setPhotoError("รูปมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง");
        return;
      }
      setPhotos((current) => [...current, { dataUrl, kb: approxKb(dataUrl) }]);
    } catch (error) {
      console.error("อ่านรูปหลักฐานไม่สำเร็จ:", error);
      setPhotoError("อ่านไฟล์รูปไม่สำเร็จ กรุณาเลือกรูปใหม่");
    } finally {
      setCompressing(false);
    }
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function resetPhotos() {
    setPhotos([]);
    setPhotoError("");
  }

  return { photos, compressing, photoError, addPhoto, removePhoto, resetPhotos };
}
