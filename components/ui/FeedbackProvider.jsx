import { createContext, useCallback, useContext, useMemo, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import Toast from "./Toast";

const FeedbackContext = createContext(null);

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used within FeedbackProvider");
  return context;
}

export default function FeedbackProvider({ children }) {
  const [confirmation, setConfirmation] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  const confirm = useCallback((options) => new Promise((resolve) => {
    setConfirmation({ ...options, resolve });
  }), []);

  const finishConfirmation = useCallback((result) => {
    confirmation?.resolve(result);
    setConfirmation(null);
  }, [confirmation]);

  const toast = useCallback((message) => setToastMessage(message), []);
  const dismissToast = useCallback(() => setToastMessage(""), []);
  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title}
        description={confirmation?.description}
        confirmLabel={confirmation?.confirmLabel}
        cancelLabel={confirmation?.cancelLabel}
        danger={confirmation?.danger}
        onConfirm={() => finishConfirmation(true)}
        onCancel={() => finishConfirmation(false)}
      />
      <Toast message={toastMessage} onClose={dismissToast} />
    </FeedbackContext.Provider>
  );
}
