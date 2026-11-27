export async function drainReceiptQueue({ getItems, update, save }) {
  while (true) {
    const item = getItems().find((entry) => entry.state === "queued");
    if (!item) return;
    update((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "saving" } : entry));
    try {
      await save(item);
      update((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      console.error("บันทึกรับโอนไม่สำเร็จ:", error);
      update((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, state: "failed", attempted: true, error: "บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อและสิทธิ์ แล้วลองใหม่" }
        : entry));
    }
  }
}
