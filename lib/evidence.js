export function canRequestEvidence(transaction, userId, isOwner) {
  return Boolean(isOwner && userId && transaction?.status === "pending" && transaction.createdBy !== userId);
}

export function canSubmitEvidence(transaction, userId, isApprovedUser) {
  return Boolean(isApprovedUser && userId && transaction?.status === "needs_evidence" && transaction.createdBy === userId);
}

export function evidencePhotos(transaction) {
  if (Array.isArray(transaction?.receiptPhotoURLs) && transaction.receiptPhotoURLs.length) {
    return transaction.receiptPhotoURLs;
  }
  return transaction?.receiptPhotoURL ? [transaction.receiptPhotoURL] : [];
}

export function evidenceSizeValid(photos, changePhoto = null, signature = null) {
  const first = photos[0] || "";
  return photos.length <= 3 &&
    photos.every((photo) => typeof photo === "string" && photo.length <= 175000) &&
    (!changePhoto || changePhoto.length <= 175000) &&
    first.length + photos.reduce((total, photo) => total + photo.length, 0) +
      (changePhoto?.length || 0) + (signature?.length || 0) <= 900000;
}
