# COM7 Employee Knowledge Hub

ศูนย์ความรู้พนักงาน COM7: ค้นหาเอกสารภายใน และถาม AI โดยคำตอบมาจาก **เอกสารที่บริษัทอัปโหลดเท่านั้น** พร้อมแหล่งอ้างอิง
ระบบเริ่มต้น **ว่างเปล่า** (ไม่มีนโยบาย สวัสดิการ หรือประกาศสมมติ) HR/ผู้ได้รับสิทธิ์อัปโหลดเอกสารเองได้โดยไม่ต้องแก้โค้ด

## เทคโนโลยี
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase (PostgreSQL, Auth, Storage, RLS) · pgvector · Google Gemini API (embedding + แชท) · Vitest

## สถานะ
| ส่วน | สถานะ |
|---|---|
| Auth, RBAC, RLS, Bootstrap admin | พร้อม |
| Dashboard, เอกสาร (อัปโหลดหลายไฟล์, เวอร์ชัน, retry, สิทธิ์รายเอกสาร) | พร้อม |
| RAG แชท (ไทย/อังกฤษ, อ้างอิงแหล่งที่มา, fallback, unanswered) | พร้อม |
| Admin (สถิติ, ผู้ใช้, บทบาท, แผนก, audit, ติดตามการประมวลผล) | พร้อม |
| ประกาศ / FAQ / ลิงก์ลัด บนหน้าแรก (ผู้จัดการดูแลเอง, เริ่มต้นว่าง) | พร้อม |
| OCR สำหรับ PDF สแกน | พร้อม แต่ **ปิดเป็นค่าเริ่มต้น** (`OCR_PROVIDER=gemini` เพื่อเปิด; ยังไม่เคยทดสอบกับ Gemini จริง) |
| เชิญผู้ใช้ทางอีเมล | พร้อมในโค้ด ต้องตั้ง SMTP + email template (ดูด้านล่าง) ยังไม่เคยทดสอบกับอีเมลจริง |
| UI/UX ตามแบรนด์ COM7 (design system, sidebar/top bar, responsive, dialog ยืนยัน, loading/error/empty states) | พร้อม ตรวจด้วยเบราว์เซอร์จริงกับข้อมูลจำลองแล้ว (ยังไม่เคยดูกับ Supabase จริง) |

## ข้อกำหนดเบื้องต้น
- Node.js 20.19+ (ทดสอบกับ 24) และ npm
- โปรเจกต์ Supabase (cloud) ที่เปิด extension `vector` ได้
- Gemini API key จาก <https://aistudio.google.com/apikey>
- (ไม่บังคับ) Supabase CLI + Docker หากต้องการรัน Supabase ในเครื่อง

## ติดตั้งและรันในเครื่อง
```bash
npm install
cp .env.example .env.local      # แล้วกรอกค่า (ดูหัวข้อถัดไป)
npm run check-env               # ตรวจว่าค่าครบ โดยไม่แสดงค่าลับ
# สร้างฐานข้อมูล: ดูหัวข้อ "ตั้งค่า Supabase"
npm run bootstrap-admin         # สร้าง/เลื่อนขั้นผู้ดูแลระบบคนแรก
npm run dev                     # http://localhost:3000
```

## ตัวแปรสภาพแวดล้อม (`.env.local`)
| ตัวแปร | ชนิด | ที่มา / หน้าที่ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase → Project Settings → API (จำกัดด้วย RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Supabase → Project Settings → API ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น **ห้ามใส่ `NEXT_PUBLIC_`** ข้าม RLS ได้ |
| `GEMINI_API_KEY` | **secret** | Google AI Studio ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น |
| `NEXT_PUBLIC_APP_URL` | public | URL ของเว็บ (ใช้เป็นลิงก์รีเซ็ตรหัสผ่าน) เช่น `http://localhost:3000` |
| `BOOTSTRAP_ADMIN_EMAILS` | ลับเล็กน้อย | อีเมลผู้ดูแลคนแรก คั่นด้วย `,` |
| `BOOTSTRAP_ADMIN_PASSWORD` | **secret** | รหัสผ่านเริ่มต้น (12+ ตัว) ของ admin ที่ถูกสร้างใหม่ ควรเปลี่ยนหลังเข้าครั้งแรก |
| `JOB_RUNNER_SECRET` | **secret** | สตริงสุ่ม 16+ ตัว ใช้เรียก `POST /api/jobs/process` |
| `GEMINI_EMBEDDING_MODEL` | ไม่บังคับ | ค่าเริ่มต้น `gemini-embedding-2` (เวกเตอร์ 768 มิติ) |
| `GEMINI_CHAT_MODEL` | ไม่บังคับ | ค่าเริ่มต้น `gemini-3.6-flash` |
| `OCR_PROVIDER` | ไม่บังคับ | `none` (ค่าเริ่มต้น) หรือ `gemini` — เปิด OCR สำหรับ PDF สแกน (ส่งไฟล์ให้ Google Gemini ถอดข้อความ จำกัด 14 MB ต่อไฟล์) |
| `RAG_TOP_K` / `RAG_MIN_SIMILARITY` | ไม่บังคับ | จำนวน chunk ที่ใช้ (6) / ความคล้ายขั้นต่ำ 0-1 (0.5) **ต้องปรับกับเอกสารจริง** |

ไม่มี `AUTH_SECRET` เพราะใช้ Supabase Auth (session เป็น cookie ที่ Supabase จัดการ) ห้าม commit ไฟล์ `.env*` ที่มีค่าจริง (`.gitignore` กันไว้แล้ว ยกเว้น `.env.example`)

## ตั้งค่า Supabase
1. สร้างโปรเจกต์ที่ <https://supabase.com> แล้วคัดลอก URL / anon key / service-role key ลง `.env.local`
2. **Authentication → Providers → Email**: ปิด *Allow new users to sign up* (ระบบไม่เปิดสมัครเอง ผู้ดูแลสร้างบัญชีให้)
3. **Authentication → URL Configuration**: ตั้ง Site URL เป็น `NEXT_PUBLIC_APP_URL` และเพิ่ม `…/auth/callback` ใน Redirect URLs (ใช้กับลืมรหัสผ่าน)
4. **Authentication → Email Templates** (ต้องทำถ้าจะใช้เชิญทางอีเมล/ลืมรหัสผ่านจากทุกเบราว์เซอร์): แก้ลิงก์ในเทมเพลตเป็น
   - *Invite user*: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/reset-password`
   - *Reset password*: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

   และตั้ง **SMTP** ของบริษัทที่ Authentication → SMTP Settings (SMTP เริ่มต้นของ Supabase ส่งได้น้อยมาก)
5. รัน migration ตามลำดับ (ด้านล่าง) ครั้งเดียวต่อฐานข้อมูล
6. Storage: migration สร้าง bucket `documents` แบบ **private** ให้อัตโนมัติ (จำกัด 20 MB) ไม่มี policy สาธารณะ ผู้ใช้เข้าไฟล์ผ่าน signed URL อายุ 60 วินาทีหลังตรวจสิทธิ์เท่านั้น

### Database migrations (`supabase/migrations/`)
| ไฟล์ | เนื้อหา |
|---|---|
| `…0001_foundation.sql` | roles/permissions, profiles, departments, categories, audit_logs, RLS, trigger กันยกระดับสิทธิ์ตัวเอง |
| `…0002_documents.sql` | documents, versions, chunks, document_access, processing_jobs, `can_access_document()`, bucket |
| `…0003_rag.sql` | pgvector, `match_document_chunks()`, chat_sessions/messages/sources, unanswered_questions |
| `…0004_admin.sql` | `access:manage`, ป้องกันการล็อกตัวเองออกจากระบบ (ผู้ดูแลคนสุดท้าย, สิทธิ์สำคัญ, system roles) |
| `…0005_content_hardening.sql` | ผู้ใช้ที่ถูกปิดบัญชีอ่านข้อมูลไม่ได้ทันที (แม้ JWT ยังไม่หมดอายุ), ตาราง `content_items` (ประกาศ/FAQ/ลิงก์ลัด), สิทธิ์ `content:manage` |

วิธีรัน: (ก) Supabase CLI: `supabase link --project-ref <ref>` แล้ว `supabase db push` หรือ (ข) คัดลอกแต่ละไฟล์ไปรันตามลำดับใน **SQL Editor**
migration ทุกไฟล์เป็นการเปลี่ยนแปลงแบบ forward-only ห้ามแก้ไฟล์ที่รันไปแล้ว ให้เพิ่มไฟล์ใหม่แทน

## Bootstrap Admin
ตั้ง `BOOTSTRAP_ADMIN_EMAILS` และ `BOOTSTRAP_ADMIN_PASSWORD` แล้วรัน `npm run bootstrap-admin` สคริปต์ **รันซ้ำได้ปลอดภัย**: ถ้าอีเมลมีบัญชีแล้วจะไม่สร้างซ้ำ และถ้าเป็น admin อยู่แล้วจะไม่เปลี่ยนอะไร (บันทึก audit เมื่อมีการเลื่อนขั้นจริง) เป็นสคริปต์ CLI ไม่ใช่ HTTP endpoint บัญชีที่สร้างใหม่ (ทั้งจากสคริปต์และจากหน้า Admin → Users) จะถูก **บังคับตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบครั้งแรก** (ธงเก็บใน `app_metadata` ซึ่งผู้ใช้แก้เองไม่ได้)

## บทบาทและสิทธิ์
| บทบาท | ทำได้ |
|---|---|
| Employee | ค้นหา/อ่านเอกสารที่มีสิทธิ์, ถาม AI, ดูประวัติของตัวเอง |
| Knowledge Manager / HR | อัปโหลด/แก้/ลบ/แทนที่เอกสาร, จัดการหมวดหมู่, ดูสถานะประมวลผล, ดูคำถามที่ AI ตอบไม่ได้ |
| Admin | ทุกอย่างข้างต้น + ผู้ใช้, บทบาท, แผนก, สิทธิ์เข้าถึงเอกสาร, audit log, สถิติ |

สิทธิ์เป็นข้อมูลในตาราง `role_permissions` (สร้างบทบาทใหม่/ปรับสิทธิ์ได้ที่ Admin → Roles) การตรวจสิทธิ์ทำที่เซิร์ฟเวอร์ (`requirePermission`) และที่ฐานข้อมูล (RLS) ไม่พึ่งการซ่อนปุ่มฝั่งหน้าเว็บ

## การอัปโหลดและการประมวลผลเอกสาร
1. ผู้จัดการเอกสารลาก/เลือกไฟล์ที่ **Documents** (PDF, DOCX, XLSX, PPTX, TXT; ไม่เกิน 20 MB; หลายไฟล์พร้อมกันได้)
2. เซิร์ฟเวอร์ตรวจนามสกุล ขนาด และ **เนื้อหาจริง** (magic bytes / โครงสร้างไฟล์) ตรวจไฟล์ซ้ำด้วย SHA-256 แล้วเก็บใน bucket private ด้วย path ที่ระบบสร้างเอง
3. สร้างงานในตาราง `processing_jobs` → worker แยกข้อความ → ทำความสะอาด → แบ่ง chunk (รองรับภาษาไทย) → สร้าง embedding → บันทึกใน **ธุรกรรมเดียว**
4. สถานะ: Uploading → Processing → **Ready** (Ready = AI ค้นหาได้แล้ว) หรือ Failed (ดูสาเหตุและกด Retry ได้) ประมวลผลซ้ำไม่สร้าง chunk ซ้ำ
5. **แทนที่เวอร์ชัน**: เวอร์ชันเดิมยังใช้งานได้จนกว่าเวอร์ชันใหม่จะ Ready ถ้าเวอร์ชันใหม่ล้มเหลวเวอร์ชันเดิมไม่หาย
6. เอกสารที่อัปโหลดก่อนเปิดใช้ AI: กดปุ่ม **Re-index** ที่หน้า Documents

Worker เริ่มทำงานทันทีหลังอัปโหลด (`after()`) งานที่ค้างหรือพลาดต้องมีตัวกวาดคิว: ตั้ง scheduler (Vercel Cron / cron ของเซิร์ฟเวอร์) เรียก `POST /api/jobs/process` พร้อม header `x-job-secret: <JOB_RUNNER_SECRET>` ทุก 5-10 นาที หรือกด *Run queue now* ที่ Admin → Processing

## การทำงานของ RAG
คำถาม → ตรวจผู้ใช้ → embed คำถาม → `match_document_chunks()` **รันในนามผู้ใช้** กรองสิทธิ์ (`can_access_document` + RLS) และเวอร์ชัน active **ภายใน SQL** ก่อนจัดอันดับ → ถ้าไม่มี chunk เกินเกณฑ์: ตอบ fallback ไทย/อังกฤษ **โดยไม่เรียกโมเดล** → มี: ส่งเฉพาะ chunk ที่ได้สิทธิ์ให้ Gemini ภายใต้ system prompt ที่บังคับให้ตอบจากแหล่งที่ให้และอ้างอิงเลข → ตรวจว่าอ้างอิงตรงกับ chunk ที่ดึงมาจริง (ไม่มี = ไม่แสดงคำตอบ) → บันทึกข้อความ + แหล่งอ้างอิง (ชื่อ เวอร์ชัน หน้า) ถ้าตอบไม่ได้ จะบันทึกใน Unanswered questions เนื้อหาเอกสารถูกครอบเป็นข้อมูลที่ไม่น่าเชื่อถือ ไม่ใช่คำสั่ง

## UI / Design system
สีแบรนด์ **วัดจากโลโก้จริง** (`public/brand/com7-logo.png`): เขียว `#5CB946`, เทา `#898B8F` ทั้งหมดนิยามเป็น token ใน `src/app/globals.css`
- เขียวโลโก้ (`brand-500`) ใช้กับไอคอน/เส้นเน้น/ตกแต่งเท่านั้น เพราะเทียบกับตัวหนังสือขาวได้เพียง 2.5:1; ปุ่มและลิงก์ใช้เขียวเข้ม `brand-700` (`#337F2C`, 5.0:1 ผ่าน WCAG AA)
- สีกลางทั้งสเกล (`slate-*`) ถูกกำหนดใหม่จากเทาของโลโก้ ทุกคลาสเดิมจึงเป็นสีแบรนด์โดยอัตโนมัติ
- ฟอนต์ IBM Plex Sans Thai (ไทย+อังกฤษในตระกูลเดียว), มุม 6-8px, เงา 2 ระดับ (`shadow-card`, `shadow-pop`), focus ring เดียวกันทั้งระบบ, รองรับ `prefers-reduced-motion`
- คอมโพเนนต์กลาง: `src/components/ui/` (button, input, card, table, badge, alert-dialog, skeleton, `page-header`, `empty-state`, `confirm-submit`, `popover-menu`, `page-skeleton`, `error-panel`), `src/components/layout/` (`AppShell`, `ShellFrame`, `NavLinks`, `Breadcrumbs`, `NotificationBell`), `src/components/brand/logo.tsx`
- ฝั่ง Admin แยกภาพลักษณ์ชัดเจน: sidebar สีเข้ม + ป้าย "Admin Console"; ฝั่งพนักงานใช้ sidebar สีขาว
- ปุ่มลบทุกจุดมี dialog ยืนยัน (`ConfirmSubmit`) โดยยังเรียก server action เดิม
- โลโก้ในโฟลเดอร์ `public/brand/` และไอคอนเว็บ `src/app/icon.png` ตัดมาจากโลโก้ COM7 ที่ให้มา ถ้ามีไฟล์โลโก้ทางการ (SVG) ให้แทนที่ได้โดยตรง
- ตั้งค่า `NEXT_DIST_DIR` (ไม่บังคับ) เพื่อให้ `next build` เขียนไปยังโฟลเดอร์อื่น เช่น ตอนต้องการ build ทดสอบข้างเซิร์ฟเวอร์ `npm run dev` ที่กำลังรันอยู่ (ค่าเริ่มต้น `.next`)

## ทดสอบ
```bash
npm run check      # typecheck + lint + unit/route tests + database tests
npm test           # vitest: ตรวจไฟล์, แยกข้อความ, chunking, RAG, route, processing, auth/proxy
npm run test:db    # migration + RLS บน Postgres จริง (PGlite) ไม่ต้องใช้ Docker/Supabase
npm run build
npm run smoke      # (หลัง build) รัน production server จริง ตรวจ headers/CSP, การป้องกันหน้า และ API 401
```
**ข้อจำกัดของเทสต์**: ไม่ได้เรียก Gemini หรือ Supabase จริง (ใช้ mock) และ `test:db` จำลองชนิด `vector` เพราะ PGlite ไม่มี pgvector จึงต้องทดสอบเองบนระบบจริงตามรายการด้านล่าง

### รายการทดสอบด้วยมือบนระบบจริง (ก่อนเปิดใช้งาน)
- [ ] บัญชีที่ Admin สร้าง/เชิญ ถูกบังคับตั้งรหัสผ่านใหม่ครั้งแรก; อีเมลเชิญและอีเมลลืมรหัสผ่านใช้งานได้ (หลังตั้ง SMTP + template)
- [ ] เปิด `OCR_PROVIDER=gemini` แล้วอัปโหลด PDF สแกนภาษาไทย/อังกฤษ ตรวจความถูกต้องของข้อความและเลขหน้า
- [ ] ผู้จัดการเพิ่มประกาศ/FAQ/ลิงก์ลัด แล้วพนักงานเห็นบนหน้าแรก (ฉบับร่างไม่แสดง)
- [ ] เปิดเว็บ production จริงในเบราว์เซอร์ ตรวจว่าไม่มี error จาก CSP ใน Console ทุกหน้า
- [ ] ล็อกอิน/ออก/ลืมรหัสผ่าน; ผู้ใช้ที่ถูกปิดบัญชีเข้าไม่ได้; ไม่มีหน้าสมัครสมาชิก
- [ ] Employee เข้า `/admin/*`, `/categories`, อัปโหลด ไม่ได้
- [ ] อัปโหลด PDF/DOCX/XLSX/PPTX/TXT อย่างละไฟล์ (เดี่ยวและพร้อมกัน), ไฟล์ซ้ำ, ไฟล์นามสกุลปลอม, ไฟล์เกิน 20 MB ถูกปฏิเสธ
- [ ] PDF สแกนขึ้น Failed `needs_ocr`; Retry หลังตั้งค่าที่ขาดแล้วผ่าน
- [ ] แทนที่เวอร์ชัน: ระหว่างประมวลผลยังตอบจากเวอร์ชันเก่า, เสร็จแล้วตอบจากเวอร์ชันใหม่
- [ ] เอกสาร "จำกัดสิทธิ์" ให้แผนก A: ผู้ใช้แผนก B ไม่เห็นในรายการ ไม่เปิดไฟล์ได้ และ **AI ไม่ตอบ/ไม่อ้างอิงเนื้อหานั้น**
- [ ] ถามเรื่องที่ไม่มีในเอกสาร → ได้ข้อความ fallback และขึ้นใน Unanswered
- [ ] ถามไทย/อังกฤษ ได้แหล่งอ้างอิงที่คลิกเปิดไฟล์ได้; ปรับ `RAG_MIN_SIMILARITY` จนผลสมเหตุสมผล
- [ ] ลองใส่ข้อความ "ละเว้นกฎก่อนหน้า…" ในเอกสารทดสอบ แล้วยืนยันว่า AI ไม่ทำตาม
- [ ] Admin: ลดสิทธิ์/ปิดบัญชี admin คนสุดท้ายไม่ได้; audit log บันทึกการเปลี่ยนแปลง

## ความปลอดภัย (สรุป)
- RLS ทุกตาราง; `anon` ไม่มีสิทธิ์ตาราง; ผู้ใช้เขียนข้อความแชท/แหล่งอ้างอิง/audit เองไม่ได้
- `SUPABASE_SERVICE_ROLE_KEY` และ `GEMINI_API_KEY` ใช้เฉพาะไฟล์ที่ import `server-only`; ไม่มีใน bundle ฝั่ง client
- Security headers (nosniff, X-Frame-Options DENY, HSTS, Referrer/Permissions-Policy) ตั้งใน `next.config.ts`
- Rate limit: แชท 15 คำถาม/นาที/ผู้ใช้ และอัปโหลด 60 ไฟล์/นาที/ผู้ใช้ (นับจากข้อมูลในฐานข้อมูล) การล็อกอินพึ่ง rate limit ของ Supabase Auth
- ข้อความ error ภายนอกเป็นข้อความทั่วไป รายละเอียดอยู่ใน log ฝั่งเซิร์ฟเวอร์
- Content-Security-Policy (เฉพาะ production): `default-src 'self'`, ไม่อนุญาต frame/object/ปลายทางฟอร์มภายนอก; ยังต้องใช้ `'unsafe-inline'` กับ script/style เพราะ Next.js ฝัง inline script (นโยบายแบบ nonce เข้มกว่าแต่บังคับให้ทุกหน้า render แบบ dynamic) **ควรเปิดเว็บ production จริงแล้วดู Console ว่าไม่มี CSP error**
- ผู้ใช้ที่ถูกปิดบัญชีถูกตัดสิทธิ์ทันทีทั้งที่แอป (`getCurrentUser`), ฐานข้อมูล (RLS `is_active_user()`) และชั้น Auth (ban)
- `npm audit --omit=dev` = 0 ช่องโหว่ (เครื่องมือ `shadcn` อยู่ใน devDependencies; ตัว CLI ยังมีคำเตือนที่ไม่กระทบ production)

## เตรียม Deploy
1. ตั้ง environment variables ทั้งหมดบนแพลตฟอร์ม (ค่าลับตั้งเป็น secret) แล้วรัน `npm run check-env` กับค่าชุดนั้น
2. รัน migration กับฐานข้อมูล production; ตั้ง Auth (ปิด sign-up, Site URL/Redirect URL เป็นโดเมนจริง, ตั้ง SMTP ของตัวเองสำหรับอีเมลลืมรหัสผ่านเพราะ SMTP เริ่มต้นของ Supabase จำกัดมาก)
3. `npm run build && npm start` (หรือ deploy ผ่านแพลตฟอร์มที่รองรับ Next.js)
4. ตั้ง scheduler เรียก `/api/jobs/process` (ดูด้านบน) และใช้ HTTPS
5. รัน `npm run bootstrap-admin` กับฐานข้อมูล production แล้วเปลี่ยนรหัสผ่าน admin
6. **ข้อควรระวัง**: การอัปโหลดผ่าน route ของ Next.js ติดข้อจำกัดขนาด body ของบางแพลตฟอร์ม (เช่น Vercel serverless ประมาณ 4.5 MB) หากใช้แพลตฟอร์มนั้นต้องเปลี่ยนเป็นอัปโหลดตรงเข้า Supabase Storage ผ่าน signed upload URL (**ยังไม่ได้ทำ** เพราะต้องทดสอบกับ Storage จริงและยังไม่ทราบแพลตฟอร์มปลายทาง) หรือ deploy แบบ Node server/Docker ที่ไม่มีข้อจำกัดนี้ — แนะนำ Docker/Node server เพื่อให้ใช้โค้ดปัจจุบันได้เลย
7. การประมวลผลเอกสารใหญ่ใช้เวลาหลายวินาที-นาที ตรวจ `maxDuration` ของแพลตฟอร์ม
8. สำรองข้อมูล: เปิด backup ของ Supabase (ฐานข้อมูล) และพิจารณาสำรอง bucket `documents`
9. ก่อนเปิดให้พนักงาน: ทำรายการทดสอบด้วยมือด้านบนทั้งหมด และขออนุมัติจากบริษัท

## โครงสร้างโปรเจกต์
```
src/app/            (auth) (employee) admin api   — หน้าและ route handlers
src/components/     ui auth documents chat admin categories
src/lib/            supabase/ auth/ permissions/ validation/ audit.ts ai-config.ts env.ts
src/services/       ai/ (gemini, embedding, vector-search, prompt, citation, rag)  documents/ (validation, extraction, ocr, chunking, upload, processing)  admin/
supabase/migrations/  ฐานข้อมูลทั้งหมด (version-controlled)
scripts/            bootstrap-admin.mjs, check-env.mjs
tests/              unit/route tests (vitest) + db/ (migration & RLS)
```
