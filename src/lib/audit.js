import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export function newAuditEvent({ actorUid, actorName, action, targetCollection, targetId, before, after, id }) {
  const ref = id
    ? doc(db, "auditLogs", id)
    : doc(collection(db, "auditLogs"));
  const activityRef = doc(db, "activityLogs", ref.id);

  return {
    ref,
    activityRef,
    data: {
      actorUid,
      actorName: actorName || "",
      action,
      targetCollection,
      targetId,
      before,
      after,
      createdAt: serverTimestamp(),
    },
  };
}

export function queueAuditEvent(batch, audit) {
  batch.set(audit.ref, audit.data);
  batch.set(audit.activityRef, audit.data);
}
