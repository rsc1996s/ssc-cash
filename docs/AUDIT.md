# ตรวจสอบ UX และความถูกต้องของระบบเงินสด

วันที่ตรวจ 27 พฤศจิกายน 2569; เลขบรรทัดในส่วนสำรวจอ้างอิงโค้ดก่อนแก้รอบนี้

## ข้อจำกัดความปลอดภัย

- ผู้ใช้อนุญาตให้ทำต่อโดยไม่ใช้ Git: โฟลเดอร์ไม่มี `.git` และไม่พบ Git จึงสร้าง branch, commit ราย phase หรือเปรียบเทียบ git diff ไม่ได้ ห้ามถือว่าการตรวจนี้ยืนยันไฟล์ที่เปลี่ยนก่อนหน้านี้
- ไม่เขียนหรือลบข้อมูล Firestore จริง และไม่ deploy
- Firestore emulator ต้องใช้ Java ซึ่งไม่พบใน PATH; ยังไม่ได้ยืนยัน rules หรือธุรกรรมจริง

## Phase 1: inventory

### Route และเมนู

รายการ route จาก `src/App.jsx:43-182`; เมนูหลักจาก `src/components/navItems.js:11-27`, shortcut จาก `src/components/Navbar.jsx:172-178` และ `src/components/Sidebar.jsx:75`

| Route | หน้า / ทางเข้า | สิทธิ์ |
|---|---|---|
| `/login`, `/register`, `/pending` | Login, Register, PendingApproval | สาธารณะ / รออนุมัติ |
| `/` | Home → StaffDashboard หรือ GuestDashboard | ผู้ใช้ที่ผ่าน ProtectedRoute |
| `/new` | NewTransaction; ปุ่มเพิ่มรายการ | owner, staff |
| `/receipts`, `/receipts/print` | Receipts และ ReceiptReport; เมนู, ทางลัด, ลิงก์พิมพ์ | owner, staff |
| `/transaction/:id`, `/transaction/:id/print` | TransactionDetail, PrintVoucher; ลิงก์จากรายการ | ผู้ใช้ที่ผ่าน ProtectedRoute; ข้อมูลจำกัดด้วย rules |
| `/owner` | OwnerDashboard; ตรวจสอบทั้งหมด | owner |
| `/admin/funds` | AdminFunds; งบค่าใช้จ่าย | owner |
| `/reports` | Reports; รายงาน | owner, guest |
| `/daily-closings` | DailyClosings; ปิดยอด | owner, staff |
| `/transfers` | TransfersHub; โอนจ่าย / ใบเบิก | owner, staff |
| `/transfers/withdrawals/new`, `/transfers/withdrawals/:id`, `/transfers/withdrawals/:id/print` | WithdrawalRequestForm, WithdrawalRequestPrint | owner, staff |
| `/transfers/payments/new`, `/transfers/payments/:id`, `/transfers/payments/:id/print` | TransferPaymentForm, TransferPaymentPrint | owner |
| `/settings`, `/settings/users`, `/settings/categories`, `/settings/bank-accounts`, `/settings/activity` | Settings, AdminUsers, SettingsCategories, BankAccounts, ActivityHistory | owner |
| `/change-pin` | ChangePin; เมนูผู้ใช้ | ผู้ใช้ที่ผ่าน ProtectedRoute |
| `/admin/users`, `/transfers/accounts`, `/activity` | redirect ไปหน้าตั้งค่าที่สอดคล้องกัน | ปลายทางตรวจสิทธิ์ |

`src/components/Layout.jsx`, Navbar, Sidebar, PageTransition และ ProtectedRoute เป็นโครงนำทาง; `src/components/ui/` มี Sheet, Modal, FormHeader, ConfirmDialog, SearchPicker, StatusBadge, Input, Button, Card, Toast และ Loading. ฟีเจอร์หลักใช้ FundDashboard, MetricCard, TransactionFilterPanel, ReceiptApproval, ReceiptQueueProvider, CategoryManager, BankAccountCreateSheet, SignaturePad และ PrintSheet

### Collection และจุดเขียน

| ข้อมูล | จุดเขียนที่พบ |
|---|---|
| `funds` | สร้าง/แก้ `src/pages/AdminFunds.jsx:80,248`; marker เติมเงิน `:153`; marker ธุรกรรม `src/lib/createIncomeTransfer.js:19`; ปิดงบ `netlify/functions/archive-fund.mjs:19,42` |
| `fundTopups` | สร้าง `src/pages/AdminFunds.jsx:128-158`; ยกเลิก `:291-297` |
| `transactions` | สร้างทั้งรายการทั่วไปและรับโอน `src/lib/createIncomeTransfer.js:13-23`, เรียกจาก `src/pages/NewTransaction.jsx:194` และ `src/lib/createIncomeTransfer.js:27`; แก้/เปลี่ยนสถานะ `src/pages/TransactionDetail.jsx:106,241,274,306,339`; อนุมัติชุด `src/components/ReceiptApproval.jsx:61,77` |
| `withdrawalRequests`, `transferPayments` | สร้าง/แก้/ลบ `src/pages/WithdrawalRequestForm.jsx:323,338,395`, `src/pages/TransferPaymentForm.jsx:219,237,248,300` |
| `cashCategories`, `transferCategories` | สร้าง `cashCategories` ที่ `src/components/CategoryManager.jsx:50` และ `src/pages/WithdrawalRequestForm.jsx:215`; ลบทั้งสองชุดผ่าน `CategoryManager.jsx:70`; อ่านทั้งสองชุดที่ `src/hooks/useCategories.js:16-30` |
| `bankAccounts` | สร้าง `src/components/BankAccountCreateSheet.jsx:129`; ลบ `src/pages/BankAccounts.jsx:28` |
| `users`, `pinDirectory`, `meta` | สมัคร `src/pages/Register.jsx:87-96`; จัดการ `src/pages/AdminUsers.jsx:115,363,393,422,465,553` |
| `counters` | เลขเอกสาร `src/lib/counters.js:10-14` |
| `auditLogs`, `activityLogs` | `src/lib/audit.js:6-8,27-28` ใน batch/transaction ของแต่ละงาน; backend `netlify/functions/archive-fund.mjs:16-17` และ `close-daily-fund.mjs:151-190` |
| `dailyClosings` | เรียก `src/pages/DailyClosings.jsx:98` ไป backend `netlify/functions/close-daily-fund.mjs:82` |

### Task → ทางเข้าและจุดเขียน

| งาน | ทางเข้า | จุดเขียน / ซ้ำ |
|---|---|---|
| เติมเงินเข้างบ | `/admin/funds` การ์ด; `/new` ทางลัดไปหน้างบ | เดิมมีผู้เขียนเดียว `AdminFunds.jsx:140`; ทางลัดยังเปลี่ยนหน้า |
| รายรับ | `/new`; `/receipts`; ปุ่ม + | UI สองแบบ, ทั้งคู่ใช้ `createIncomeTransfer.js:13`; payload ต่างตามงาน |
| รายจ่าย/ขอเบิก | `/new`; `/transfers/withdrawals/new` | ธุรกรรมเงินสดกับใบเบิกเป็นคนละเอกสาร/ขั้นตอน ไม่ควรรวมโดยอัตโนมัติ |
| โอนจ่าย | `/transfers/payments/new` และหน้าแก้ไข | `TransferPaymentForm.jsx:219`; ตัวนับ `counters.js:10` |
| ตรวจสอบ/อนุมัติ | `/owner` → รายละเอียด; `/receipts` อนุมัติชุด | สองจุด `TransactionDetail.jsx:306`, `ReceiptApproval.jsx:61`; คงขั้นลายเซ็น/audit และต้องทดสอบ rules ก่อนรวม |
| ปิดยอด | `/daily-closings` สร้าง/แก้ revision | backend เดียว `close-daily-fund.mjs:82` |
| รายงาน | `/reports`, `/receipts/print`, ใบพิมพ์รายการ/โอน | อ่านข้อมูลเดียวกันในบริบทต่างกัน ไม่ใช่จุดเขียน |
| ผู้ใช้/งบ/ตั้งค่า | `/settings/*`, `/admin/funds`, สมัคร | รายละเอียดจุดเขียนในตาราง collection |
| หมวดหมู่ | ตั้งค่า และสร้างจากใบเบิก | `CategoryManager.jsx:50`, `WithdrawalRequestForm.jsx:215` สองจุดเขียน |

## Phase 2: หลักฐานสมมติฐาน

| สมมติฐาน | ผล | หลักฐานและผลกระทบ | แนวทาง |
|---|---|---|---|
| H1 เติมงบสองทาง | จริงด้านทางเข้า; ไม่จริงด้านโค้ดเขียน | `NewTransaction.jsx:94-103` ย้ายหน้า; `AdminFunds.jsx:105-160` เขียนทางเดียว จึงไม่มี payload สองชนิด | ใช้ฟอร์มเดียวเปิดได้จากทั้งสองบริบท |
| H2 ฝั่งปนช่องทาง | จริงบางส่วน | `AdminFunds.jsx:66-70` เก็บ label ไม่เก็บชนิดเงิน; `NewTransaction.jsx:350,403` เลือกงบกับช่องทางอิสระ; `ledger.js:14-39` หัก/เพิ่มตาม fundId โดยไม่เช็ค paymentMethod; backend ปิดยอดเลือกเฉพาะ cash ที่ `close-daily-fund.mjs:76-79` | ไม่เดาชนิดจากชื่อ; ชี้แจงในฟอร์ม และถามเจ้าของเรื่องโครงสร้าง/ความหมาย |
| H3 เงินเข้าซ้ำ | ตรวจพบความเสี่ยง แต่ไม่พิสูจน์ว่าเคยเกิดจริง | `incomeDuplicates.js:7-36` เทียบงบ/วัน/ยอดระหว่าง topup กับรายรับ จึงเป็นเพียงสัญญาณ; `AdminFunds.jsx:128` สร้าง ID ใหม่ต่อครั้ง; ต่างช่องทางบันทึกเงินก้อนเดียวกันได้ | เตือนตามข้อมูลที่เห็น ไม่สรุปเหตุการณ์จริง; เพิ่มการป้องกัน retry โดยไม่เปลี่ยนยอด |
| H4 เมนูซ้อน | จริงในแง่ข้อมูลซ้ำ ไม่ใช่งานเดียวกันทั้งหมด | dashboard ใช้ข้อมูล scoped (`FundDashboard.jsx:23-56`), owner ตรวจรายการ, Reports สร้าง ledger (`reportLedger.js:22`), ปิดยอดเรียก backend (`DailyClosings.jsx:98`), โอนจ่ายใช้เอกสารโอน (`TransferPaymentForm.jsx:217-252`) | คงบริบทและสิทธิ์; ยังไม่ตัดเมนู |
| H5 component/util ซ้ำ | จริงบางส่วน | `Sheet.jsx` และ `Modal.jsx` ใช้ต่างบริบท; `Sidebar.jsx:16` และ `Navbar.jsx:14` มี NavBadge; format วันที่ `format.js:6-18`, `businessDate.js:18-24`; สร้างหมวดสองจุดตามตาราง | รวมเฉพาะที่พิสูจน์ว่าพฤติกรรมตรงกัน; ไม่ลบคอมโพเนนต์ที่ยังมีผู้ใช้ |
| H6 อื่น | พบความเสี่ยง | คิวรับโอนเก็บใน memory `ReceiptQueueProvider.jsx:18-19`; batch approval ขนาด 5 `ReceiptApproval.jsx:14` ยังไม่ทดสอบ emulator; ระบบไม่มีฟิลด์ชนิดงบ | ระบุข้อจำกัด ไม่อ้างว่าทดสอบ Firestore จริงแล้ว |

## Phase 3: แผนก่อนแก้ (ความเสี่ยงต่ำ → สูง)

1. ย้ายฟอร์มเติมเงินและการเขียนเดิมไป component/service ร่วม โดยรักษา payload, audit และ rules; เปิดจาก `/new` ได้โดยไม่ทำ draft รายการหาย และล็อกงบเมื่อเปิดจากการ์ด
2. ตรวจจำนวนเงินด้วยสตางค์, ป้องกันกดซ้ำและ retry ด้วย ID เดิมและตรวจ server ก่อน retry; เตือนเมื่อเงินเติมงบเดียวกันยอดเท่ากันภายใน 10 นาที และคงคำเตือนรายรับเดิม โดยไม่อ้างว่าพิสูจน์ได้ว่าซ้ำ
3. เพิ่มยอดก่อน/หลังและคำอธิบายงบ/ช่องทางโดยไม่เดาจากชื่อ; แสดงข้อมูลเก่าที่ขาดเป็น `-` เมื่อมีข้อมูลที่เกี่ยวข้อง
4. เลือกแสดงวันที่เต็มรูป `dd/mm/yyyy` ปี พ.ศ. ตาม locale ภาษาไทยเดิม โดยคงวันธุรกิจและเวลาเดิม; ช่อง date ของระบบปฏิบัติการอาจแสดงต่างกัน
5. ประเมินฟิลด์ใหม่และโอนระหว่างงบ: ห้ามเปิดใช้จนแบบบัญชีและ rules ทดสอบได้ เนื่องจาก topup เป็นจำนวนบวกเท่านั้นและปิดยอด backend นับทุก topup เป็นเงินสด การทำรายการคู่แบบเดาอาจทำยอดผิด
6. ตรวจ build/tests และทบทวนโค้ดที่เปลี่ยนด้วยตนเอง; ไม่ใช้ข้อมูลจริง

## ต้องถามเจ้าของ

- งบเป็นบัญชีเงินจริงแยกตามเงินสด/ธนาคารหรือเป็นเพียงหมวดจัดสรร? ชื่อเดิมไม่ใช่ข้อมูลชนิดที่ตรวจสอบได้ และต้องตกลงแนวทางย้ายข้อมูลก่อนเตือนว่าเลือกช่องทางขัดกัน
- การโอนระหว่างงบต้องใช้รายการรายจ่ายที่ต้องอนุมัติ/ลงลายเซ็นหรือรายการบัญชีชนิดใหม่? การกลับรายการคู่และผลต่อปิดยอดย้อนหลังควรเป็นอย่างไร?
- แหล่งที่มา “รายรับจากการขาย” จะนับเป็นเงินเติมทันทีหรือรายรับรออนุมัติ? หากรับทั้งสองทางอาจนับซ้ำ

## ค้างและเหตุผล

- ฟิลด์ `occurredAt`, `recordedAt`, `sourceType`, `sourceName`, `method`, `fromAccount`, `toAccount`, `refNo`, `slipPhotoURL`, `transferGroupId` ยังไม่ได้เปิดใช้: rules เดิมมี allowlist และการแยกวิธีรับกระทบยอดปิดเงินสด; ต้องออกแบบและทดสอบ rules/backward compatibility ก่อน
- ฟอร์มยังไม่มีเวลาเงินเข้า แหล่งที่มา วิธีรับ บัญชี สลิป การกรองประวัติ และการตรวจเลขอ้างอิงซ้ำ; ประวัติยังไม่ได้แสดงฟิลด์ใหม่ เพราะยังไม่มี schema ที่ตกลงและรองรับใน rules
- การโอนระหว่างงบแบบ atomic ไม่รองรับใน rules/ledger เดิม; ไม่สร้างคู่รายการที่ทำให้ยอดผิด
- การรวมจุดอนุมัติและสร้างหมวด ยังต้องทบทวนสิทธิ์และ UX ให้ครบก่อน
- คำเตือน 10 นาทีอิงเวลาบันทึกที่ไคลเอนต์เห็น ไม่ใช่การป้องกันพร้อมกันที่เซิร์ฟเวอร์; การลองซ้ำใช้ ID เดิมเฉพาะขณะที่ไดอะล็อกยังเปิด หากปิดหรือรีเฟรชต้องตรวจประวัติก่อนสร้างใหม่
- รูปแบบช่องเลือกวันที่ native ขึ้นอยู่กับ browser/ระบบปฏิบัติการ; แกนกราฟและป้ายเดือนแสดงแบบย่อ
- ปุ่มบันทึกคงไว้ที่ header ชุดเดียวตามข้อกำหนดฟอร์มเดิม จึงยังไม่มีปุ่มบันทึกซ้ำที่ด้านล่าง
- ฟอร์มและการกระทำเดิมนอกขอบเขตที่แก้ยังไม่ได้ตรวจทุก edge case และทุก breakpoint

## Phase 4–5: ทำแล้วและตรวจซ้ำ

- แยก `src/components/TopUpDialog.jsx` และ `src/lib/createFundTopup.js` ใช้ร่วมจากการ์ดงบและ `/new`; คงโครงสร้าง topup, audit และ marker เดิม ไม่แก้ rules หรือ backend
- ฟอร์มตรวจจำนวนสตางค์ แสดงยอดก่อน/หลัง คงคำเตือนรายรับ และเตือนยอดเติมเดียวกันภายใน 10 นาที; ป้องกันกดซ้ำระหว่างส่งและตรวจ ID เดิมจาก server ก่อน retry โดยคง draft ที่ส่งไว้
- เปลี่ยนข้อความอธิบายงบ/ช่องทาง และแสดงวันที่เต็มด้วย พ.ศ. แบบ `dd/mm/yyyy` ใน formatter กลางและจุดที่แสดง ISO โดยตรงที่พบ; ไม่เปลี่ยนวันที่ที่จัดเก็บ
- `npm test` ผ่าน 36/36; เทสต์วันที่และคำเตือนผ่านทั้ง `TZ=UTC` และ `TZ=Asia/Bangkok`; `npm run build` ผ่าน พร้อมคำเตือน chunk recharts เกิน 500 kB ซึ่งพบก่อนแก้รอบนี้เช่นกัน
- `npm run test:rules` รันไม่ได้เพราะไม่พบ Java; package ไม่มีคำสั่ง lint หรือ typecheck จึงยังไม่ได้รันทั้งสองอย่าง
- ทดสอบเฉพาะ TopUpDialog ด้วย browser และข้อมูล/service จำลองที่ 375, 768, 1024, 1440px: ไม่มี horizontal scroll, ปุ่ม header สูง 44px, mobile เต็มจอ, desktop 560px; ตรวจเลือก/ล็อกงบ, สิทธิ์ UI จำลอง, จำนวน 0/ทศนิยมเกิน, ยอดหลังเติม, เตือนซ้ำ, กด submit สองครั้ง, retry ID เดิม และเก็บ draft หน้าหลัง
- ไม่ได้ทดสอบ Firestore จริง/emulator, ความพร้อมใช้งานของ query/rules ขณะ retry, การเขียน audit จริง, การปิดยอดหลังเติม, อุปกรณ์จริง หรือทุกหน้าในทุกขนาด; browser mock ไม่พิสูจน์ว่าเขียนไม่ซ้ำใน production
- ตรวจไฟล์ที่แก้และค้นหาจุดเขียนด้วยตนเอง ไม่สามารถอ่าน git diff ทั้ง branch หรือรับรองว่า task ทุกชนิดเหลือจุดเขียนเดียวได้; ยังมีงานซ้ำตามตารางข้างต้น
- ไม่ลบหรือแก้ข้อมูล Firestore จริง และไม่ deploy; ควรทดสอบ emulator และอุปกรณ์จริงก่อนใช้ส่วนที่แก้กับเงินจริง

### ไฟล์ที่แก้/สร้างในรอบนี้

`docs/AUDIT.md`; `src/components/TopUpDialog.jsx`, `src/components/ui/Sheet.jsx`;
`src/lib/createFundTopup.js`, `src/lib/topupData.js`, `src/lib/format.js`, `src/lib/businessDate.js`;
`src/pages/AdminFunds.jsx`, `NewTransaction.jsx`, `DailyClosings.jsx`, `Receipts.jsx`, `TransferPaymentForm.jsx`, `TransactionDetail.jsx`, `ActivityHistory.jsx`;
`tests/topupData.test.js`, `tests/businessDate.test.js`, `package.json`.

## วิธีทดสอบมือ

1. ลงชื่อเข้าใช้ owner และเปิดหน้างบ ตรวจยอดก่อนเติม
2. เปิดเติมจากการ์ด ตรวจว่างบถูกล็อกและยอดก่อน/หลังสัมพันธ์กัน
3. เปิดเติมจาก `/new` เลือกงบและปิดกลับ ตรวจว่า draft รายการยังอยู่
4. ลองจำนวน 0, ติดลบ, ทศนิยมเกินสองตำแหน่ง และวันที่ไม่ถูกต้อง
5. เติมยอดเดียวกับรายรับ/รายการเติมเดิม ตรวจคำเตือนและยืนยันหรือยกเลิก
6. จำลองเน็ตหลุดตอนบันทึก แล้วลองใหม่ ตรวจ ID และประวัติว่าไม่ซ้ำ
7. เปิดประวัติข้อมูลเก่า ตรวจว่าฟิลด์ที่ขาดไม่ทำให้หน้า crash
8. เข้าด้วย staff ตรวจว่าไม่มีทางเปิดเติมและ rules ปฏิเสธการเขียนตรง
9. ทดสอบ 375, 768, 1024, 1440px และคีย์บอร์ดมือถือ ตรวจ scroll และ safe-area
10. ตรวจแดชบอร์ด รายงาน ปิดยอด และ audit หลังเติมด้วย emulator/ข้อมูลทดสอบเท่านั้น
