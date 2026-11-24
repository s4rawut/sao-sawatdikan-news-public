# คู่มือติดตั้งเว็บสวัสดิการ สตง. บนระบบภายใน

สำหรับ: ทีม IT ที่จะติดตั้งและดูแลระบบ
ปรับปรุง: 24 พฤศจิกายน 2569

ระบบเป็นแอป **Node.js** ทั่วไป ติดตั้งได้บนเครื่องจริง เครื่องเสมือน (VM) หรือ cloud ของหน่วยงานแบบใดก็ได้ ขอแค่มีดิสก์ถาวรสำหรับเก็บข้อมูล (ข้อ 2)

---

## 1. ภาพรวมระบบ

| ส่วน | รายละเอียด |
|---|---|
| ตัวเว็บ | Astro 7 + EmDash CMS (เว็บข่าว สิทธิประโยชน์ ระเบียบ ชมรม ฯลฯ) และระบบร้านค้าสวัสดิการ (สมาชิก ตะกร้า คำสั่งซื้อ หลังบ้านร้าน) |
| ตัวรัน | Node.js process เดียว (`dist/server/entry.mjs`) ฟังที่พอร์ต `4321` |
| ฐานข้อมูล | SQLite ไฟล์เดียว `data/emdash.db` (รวมเนื้อหาเว็บ ผู้ใช้ สมาชิกร้าน คำสั่งซื้อ) — ไม่ต้องติดตั้ง database server |
| ไฟล์ | `data/uploads/` รูป ไฟล์แนบระเบียบ (PDF) สลิปโอนเงิน |
| หน้าเว็บ https | reverse proxy (nginx, Apache, IIS, load balancer ของ cloud) รับ https แล้วส่งต่อให้ Node.js |
| งานตั้งเวลา | ทำงานใน process เดียวกัน: ยกเลิกคำสั่งซื้อที่ไม่ชำระ (คืนสต็อก) ทุกชั่วโมง, เผยแพร่ข่าวตามเวลา |

> **ข้อมูลส่วนบุคคล (PDPA):** `data/` มีข้อมูลสมาชิก เบอร์โทร คำสั่งซื้อ และสลิปโอนเงิน ให้จำกัดสิทธิ์เข้าถึงไฟล์เฉพาะผู้ดูแลระบบ และเข้ารหัสไฟล์สำรอง

## 2. ความต้องการของเครื่อง

- **Node.js 24 LTS** (ขั้นต่ำ 22.23.4) ที่รองรับ SQLite FTS5 — ตรวจด้วย:
  ```bash
  node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; new DatabaseSync(":memory:").exec("CREATE VIRTUAL TABLE t USING fts5(x)"); console.log("FTS5 OK")'
  ```
  (Node จาก nodejs.org และ image ทางการ `node:24` มี FTS5 แล้ว ถ้าไม่มี ช่องค้นหาจะใช้ไม่ได้)
- RAM 2 GB, CPU 2 core, ดิสก์ว่าง 10 GB ขึ้นไป
- **ดิสก์ถาวรสำหรับ `data/`** — ต้องเป็นดิสก์ในเครื่องหรือ block volume (ห้าม NFS/SMB/file share เพราะ SQLite ใช้ WAL) และข้อมูลต้องไม่หายเมื่อรีสตาร์ต/สร้าง container ใหม่
- reverse proxy + ใบรับรอง SSL ของโดเมนจริง
- ตอน `npm ci` และ build ต้องออกอินเทอร์เน็ตได้ (ดาวน์โหลดแพ็กเกจและฟอนต์) — ตอนใช้งานจริงไม่จำเป็น ยกเว้นฟีเจอร์ในข้อ 9

## 3. เลือกแบบติดตั้ง

| ระบบของหน่วยงาน | ใช้แบบ |
|---|---|
| มี Docker / Podman หรือแพลตฟอร์ม container (Kubernetes, OpenShift, บริการ container ของ cloud) | **3B** container (แนะนำ: มี image สำเร็จรูป) |
| เครื่อง Linux หรือ VM (on-premise, VMware, Hyper-V, VM บน cloud ใดก็ได้) ที่ไม่ใช้ container | **3A** systemd + nginx |
| Windows Server | **3C** Node.js เป็น Windows service + IIS |

ทุกแบบใช้ค่าตั้งเดียวกันใน `.env` (ข้อ 10) และต้องตั้ง `SITE_URL` ก่อน build

### 3A. Linux / VM (systemd + nginx)

```bash
# 1) ผู้ใช้สำหรับรันเว็บ และโฟลเดอร์
sudo useradd --system --create-home --home-dir /opt/sao-welfare saoweb
sudo -u saoweb -i
cd /opt/sao-welfare
git clone https://github.com/s4rawut/sao-sawatdikan-news-public.git .   # หรือแตกไฟล์ zip ของซอร์สโค้ดไว้ที่นี่

# 2) ตั้งค่า
cp .env.example .env
nano .env                      # แก้ SITE_URL, EMDASH_SITE_URL เป็นโดเมนจริง (https://...)
npx emdash secrets generate    # คัดลอกค่าไปใส่ EMDASH_ENCRYPTION_KEY ใน .env และเก็บสำรองไว้ที่ปลอดภัย
chmod 600 .env

# 3) ติดตั้งและ build
npm ci
npm run build

# 4) ข้อมูล: วางโฟลเดอร์ data/ ที่ได้รับ (emdash.db + uploads/) ไว้ที่ /opt/sao-welfare/data
mkdir -p data backups && chmod 700 data backups

# 5) ลองรัน
npm start                      # เปิด http://127.0.0.1:4321 จากเครื่องนั้น ต้องเห็นหน้าเว็บ แล้วกด Ctrl+C
exit
```

```bash
# 6) ให้รันตลอดและเปิดเองเมื่อเครื่องรีสตาร์ต
sudo cp /opt/sao-welfare/deploy/sao-welfare.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sao-welfare
journalctl -u sao-welfare -f   # ต้องเห็น "Server listening on http://127.0.0.1:4321"

# 7) nginx (แก้ server_name และไฟล์ใบรับรองก่อน)
sudo cp /opt/sao-welfare/deploy/nginx.conf /etc/nginx/sites-available/sao-welfare
sudo ln -s /etc/nginx/sites-available/sao-welfare /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 3B. Container (Docker / Podman / Kubernetes / OpenShift / บริการ container ของ cloud)

**ทางที่ 1 — ใช้ image สำเร็จรูป (ง่ายที่สุด ไม่ต้อง build เอง)**

ไฟล์ `sao-welfare-image-<วันที่>-amd64.tar.gz` (เครื่อง x86_64) ผู้พัฒนาส่งให้ ใช้ได้กับทุกโดเมน ตั้งโดเมนตอนรัน:

```bash
# 1) นำ image เข้าเครื่อง
docker load -i sao-welfare-image-2569-11-24-amd64.tar.gz          # ได้ image ชื่อ sao-welfare:2569.11.24

# 2) โฟลเดอร์ข้อมูลถาวร (container รันด้วย uid 1000) แล้ววาง data/ ที่ได้รับ (emdash.db + uploads/) ลงไป
sudo mkdir -p /srv/sao-welfare/data /srv/sao-welfare/backups
sudo chown -R 1000:1000 /srv/sao-welfare

# 3) สร้างกุญแจเข้ารหัส (ครั้งเดียว เก็บสำรองไว้ที่ปลอดภัย)
docker run --rm sao-welfare:2569.11.24 ./node_modules/.bin/emdash secrets generate

# 4) รัน (แก้โดเมนและกุญแจ)
docker run -d --name sao-welfare --restart unless-stopped \
  -p 127.0.0.1:4321:4321 \
  -e SITE_URL=https://welfare.example.go.th \
  -e EMDASH_SITE_URL=https://welfare.example.go.th \
  -e EMDASH_ENCRYPTION_KEY=emdash_enc_v1_xxxxxxxx \
  -e SHOP_PAYMENT_MODE=live \
  -v /srv/sao-welfare/data:/app/data \
  -v /srv/sao-welfare/backups:/app/backups \
  sao-welfare:2569.11.24

docker logs -f sao-welfare        # ต้องเห็น "Server listening on http://0.0.0.0:4321"
```

ค่าอื่นใน `.env.example` ส่งเป็น `-e NAME=value` เพิ่มได้ (หรือ `--env-file`) · ใช้ Podman ได้ด้วยคำสั่งเดียวกัน (`podman load` / `podman run`)

**ทางที่ 2 — build เอง จากซอร์สโค้ด**

```bash
cp .env.example .env && nano .env
docker compose up -d --build       # ข้อมูลอยู่ที่ ./data และ ./backups บนเครื่อง
```
หรือ `docker build -t sao-welfare .` (image ใช้ได้ทุกโดเมนเหมือนทางที่ 1) · รู้โดเมนแล้ว: `docker build --build-arg SITE_URL=https://โดเมนจริง --build-arg ALLOWED_HOSTS= -t sao-welfare .` (จำกัดเฉพาะโดเมนนั้น + ย่อรูปอัตโนมัติ)

**ข้อบังคับเมื่อใช้ container (ทุกแพลตฟอร์ม)**
- ต่อ **persistent volume** ที่ `/app/data` (และ `/app/backups`) — ไม่มี volume ข้อมูลจะหายทุกครั้งที่ container ถูกสร้างใหม่ · volume ต้องเป็น block storage ไม่ใช่ NFS/SMB
- ตั้ง **replicas = 1** เสมอ (SQLite รองรับ process เดียว) และให้ทำงานตลอด (ไม่ scale to zero)
- ingress / load balancer ต้องส่ง header ตามหัวข้อ "reverse proxy" ด้านล่าง — image สำเร็จรูปเชื่อชื่อโดเมนที่ proxy ส่งมา จึงต้องให้ proxy เป็นผู้กำหนด `Host` / `X-Forwarded-Host` เอง (ไม่ส่งต่อค่าที่ผู้ใช้ส่งมา)
- image มี healthcheck ในตัว (เรียกหน้าแรกทุก 30 วินาที)
- สำรองข้อมูล: `docker exec sao-welfare node scripts/backup.mjs` (ไฟล์อยู่ใน `/srv/sao-welfare/backups`)
- ลิงก์เข้าหลังบ้าน (ข้อ 6): `docker exec sao-welfare node scripts/admin-login-link.mjs <email>`
- อัปเดตเวอร์ชัน: `docker load` image ใหม่ → `docker rm -f sao-welfare` → `docker run` ด้วยคำสั่งเดิมและ tag ใหม่ (ข้อมูลอยู่ใน volume ไม่หาย)

### 3C. Windows Server

1. ติดตั้ง Node.js 24 LTS และ Git จากเว็บทางการ
2. clone หรือแตกซอร์สโค้ดไว้ที่ เช่น `C:\sao-welfare` แล้วทำขั้น 2–5 ของแบบ 3A ใน PowerShell (`copy .env.example .env`, แก้ด้วย Notepad, `npm ci`, `npm run build`, วาง `data\`, `npm start`)
3. ให้รันเป็น Windows service ด้วยเครื่องมือที่หน่วยงานใช้ (เช่น NSSM: คำสั่ง `node --env-file=C:\sao-welfare\.env C:\sao-welfare\dist\server\entry.mjs`, โฟลเดอร์เริ่มต้น `C:\sao-welfare`)
4. IIS + URL Rewrite + Application Request Routing ทำ reverse proxy ไป `http://127.0.0.1:4321` และส่ง header ตามหัวข้อด้านล่าง
5. ตั้ง Task Scheduler รัน `npm run backup` ทุกวัน (ข้อ 7)

### reverse proxy (ทุกแบบ)

ต้องส่ง `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto` และ **เขียนทับ** `X-Real-IP` ด้วย IP ผู้ใช้จริง (ตัวอย่างใน `deploy/nginx.conf`) ไม่อย่างนั้นการส่งฟอร์มจะถูกปฏิเสธ และระบบกันเดารหัสผ่านนับ IP ผิด · รองรับไฟล์อัปโหลดถึง 25 MB (PDF สแกน) · ถ้าใช้ header อื่นแทน X-Real-IP ให้ตั้ง `TRUSTED_PROXY_HEADERS`

## 4. การรับข้อมูลจากระบบทดสอบ (วันเปิดใช้)

ผู้พัฒนาเป็นผู้ส่งออกข้อมูลล่าสุดจากระบบทดสอบให้

1. นัดวันเวลา แจ้งผู้ใช้ปิดรับคำสั่งซื้อชั่วคราว (ประมาณ 30 นาที)
2. ผู้พัฒนาส่ง `data/emdash.db` + `data/uploads/` ให้ IT ทางช่องทางที่ปลอดภัย (มีข้อมูลส่วนบุคคล)
3. IT หยุดเว็บ วาง `data/` ใหม่ (ลบ `emdash.db-wal`, `emdash.db-shm` เก่าถ้ามี) แล้วเริ่มเว็บ
4. ตรวจตามข้อ 5
5. ชี้ DNS โดเมนจริงมาที่ระบบนี้

## 5. ตรวจหลังติดตั้ง / หลังอัปเดต

- [ ] หน้าแรก ร้านค้า ข่าว สิทธิประโยชน์ และหน้าที่มีไฟล์ PDF เปิดได้ รูปขึ้นครบ
- [ ] ช่องค้นหาด้านบนหาเจอ (ครั้งแรกระบบสร้างดัชนีค้นหาให้เอง ดูใน log ว่า "Rebuilding")
- [ ] สมัครสมาชิก (อีเมลสำนักงาน + วันเดือนปีเกิด ของคนที่อยู่ในรายชื่อ) → เข้าสู่ระบบ → ใส่ตะกร้า → สั่งซื้อ (แล้วยกเลิก)
- [ ] หลังบ้านร้านค้า `/shop-admin` เข้าด้วยบัญชีผู้ดูแลร้าน ดูคำสั่งซื้อได้
- [ ] หลังบ้านเว็บไซต์ `/_emdash/admin` เข้าได้ (ข้อ 6) แก้ข่าวทดสอบแล้วบันทึกได้ อัปโหลดรูปได้
- [ ] `npm run backup` ทำงาน (ข้อ 7)

## 6. การเข้าหลังบ้านเว็บไซต์ (EmDash) บนโดเมนใหม่

ผู้ดูแลเว็บเข้าด้วย **passkey** ซึ่งผูกกับโดเมน passkey ที่สร้างบนระบบทดสอบจึงใช้กับโดเมนใหม่ไม่ได้ ให้ออกลิงก์เข้าสู่ระบบครั้งเดียวบนเซิร์ฟเวอร์:

```bash
npm run admin-link -- --list               # ดูรายชื่อผู้ดูแล
npm run admin-link -- admin@example.com    # ได้ลิงก์ใช้ได้ครั้งเดียวภายใน 15 นาที
```
(แบบ container: `docker exec sao-welfare node scripts/admin-login-link.mjs admin@example.com` หรือ `docker compose exec web …`)

ส่งลิงก์ให้เจ้าของบัญชี → เปิดแล้วกด **Continue** → ไปที่ **Settings → Security → Register Passkey** เพื่อสร้าง passkey ของโดเมนใหม่

(ส่วนผู้ดูแลร้านค้าและสมาชิกใช้ชื่อผู้ใช้/รหัสผ่าน ใช้ได้ทันทีไม่ต้องทำอะไร)

## 7. สำรองและกู้คืนข้อมูล

```bash
npm run backup        # สร้าง backups/<วันที่_เวลา>/emdash.db + uploads/ เก็บ 14 ชุดล่าสุด (BACKUP_KEEP)
```
ตั้งให้ทำทุกวัน เช่น crontab ของผู้ใช้ saoweb (Windows: Task Scheduler · container: `docker exec sao-welfare node scripts/backup.mjs`):
```
30 2 * * *  cd /opt/sao-welfare && /usr/bin/node --env-file=.env scripts/backup.mjs >> backups/backup.log 2>&1
```
และ **คัดลอก `backups/` ไปเก็บอีกเครื่อง** ทุกวัน (ระบบสำรองของหน่วยงาน)

การสำรองใช้คำสั่ง backup ของ SQLite ทำได้ขณะเว็บทำงาน (ห้ามคัดลอกแค่ไฟล์ `emdash.db` ตรงๆ ขณะเว็บเปิดอยู่)

**กู้คืน:** หยุดเว็บ → ย้าย `data/` เดิมออก → คัดลอก `emdash.db` และ `uploads/` จากชุดสำรองมาไว้ใน `data/` → เริ่มเว็บ

## 8. อัปเดตเวอร์ชันเว็บ

```bash
sudo systemctl stop sao-welfare
sudo -u saoweb -i
cd /opt/sao-welfare && npm run backup
git pull                       # หรือแทนที่ซอร์สโค้ดด้วยเวอร์ชันใหม่ (อย่าทับ .env, data/, backups/)
npm ci && npm run build
exit
sudo systemctl start sao-welfare
```
แบบ container: สำรองข้อมูล (ผ่าน `docker exec`) แล้วโหลด image ใหม่และรัน container ใหม่ตามข้อ 3B (หรือ `git pull && docker compose up -d --build`)

ระบบปรับโครงสร้างฐานข้อมูลให้เองตอนเริ่ม

## 9. ฟีเจอร์ที่ต้องออกอินเทอร์เน็ต (ไม่บังคับ — ถ้าปิดอินเทอร์เน็ต ส่วนอื่นยังใช้ได้)

| ฟีเจอร์ | ปลายทาง | ถ้าออกไม่ได้ |
|---|---|---|
| แจ้งเตือน Telegram | api.telegram.org | ไม่แจ้งเตือน |
| ส่งอีเมล (Apps Script / Resend) | script.google.com / api.resend.com | ไม่ส่งอีเมล (ขณะนี้ปิดการส่งอีเมลไว้ในหน้าตั้งค่าร้าน) |
| กันบอท Turnstile (ถ้าตั้งค่า) | challenges.cloudflare.com | ไม่ต้องตั้งค่า TURNSTILE_* |

ไลบรารีหน้าเว็บ (ไอคอน, QR, Excel, ตัวแสดง PDF) และฟอนต์ อยู่ในเว็บเองทั้งหมด ไม่ต้องโหลดจากภายนอก

## 10. ค่าตั้ง `.env`

ดูคำอธิบายทุกค่าใน `.env.example` ค่าที่ต้องตั้ง:

| ค่า | ตัวอย่าง | หมายเหตุ |
|---|---|---|
| `SITE_URL`, `EMDASH_SITE_URL` | `https://welfare.oag.go.th` | ต้องตั้งก่อน build และตอนรัน · เปลี่ยนโดเมน = build ใหม่ |
| `ALLOWED_HOSTS` | IP ภายใน (ถ้าเปิดด้วย IP) | คั่นด้วยจุลภาค |
| `EMDASH_ENCRYPTION_KEY` | (สร้างด้วย `npx emdash secrets generate`) | สำรองเก็บไว้ |
| `DATABASE_PATH`, `UPLOADS_DIR`, `SESSIONS_DIR` | `./data/...` | ดิสก์ถาวร |
| `SHOP_PAYMENT_MODE` | `live` | `demo` = แสดง QR ตัวอย่าง |
| `SITE_GATE_USER`, `SITE_GATE_PASS` | เว้นว่าง | ใส่ค่า = ทั้งเว็บต้องใส่รหัสก่อนเข้า |

## 11. ข้อจำกัดและข้อควรรู้

- **รัน process เดียวเท่านั้น** (SQLite) ห้ามเปิดหลาย instance หรือหลาย replica ชี้ข้อมูลชุดเดียวกัน ถ้าต้องการหลายเครื่องต้องเปลี่ยนเป็น PostgreSQL (ต้องพัฒนาเพิ่ม)
- process ต้องทำงานตลอด งานตั้งเวลา (ยกเลิกคำสั่งซื้อที่ค้างชำระ) ทำงานเฉพาะตอนเว็บเปิด
- ก่อนเปิดใช้จริง: ตั้ง `SHOP_PAYMENT_MODE=live` และตรวจข้อมูลติดต่อท้ายเว็บ

## 12. สำหรับนักพัฒนา

- `npm run build` → build สำหรับเซิร์ฟเวอร์ Node.js (`scripts/build-node.mjs` อ่าน `.env` แล้ว build)
- โค้ดร้านค้าอ่านฐานข้อมูล/ไฟล์/ค่าตั้งผ่าน `env` จากโมดูล `cloudflare:workers` ซึ่งตอน build ถูกแทนด้วย `src/platform/node-env.js`:
  - `env.DB` → `src/platform/d1-sqlite.js` (ฐานข้อมูล SQLite ไฟล์เดียวกับ EmDash; `batch()` = transaction)
  - `env.MEDIA` → โฟลเดอร์ `UPLOADS_DIR`
  - ค่าอื่นของ `env` → `process.env`
  - งานรายชั่วโมงของร้านค้า (`runShopScheduled`) ตั้งเวลาด้วย `setInterval`
- สคริปต์: `scripts/admin-login-link.mjs` (ลิงก์เข้าหลังบ้าน), `scripts/backup.mjs` (สำรองข้อมูล), `scripts/build-node.mjs`, `scripts/export-static.mjs` (ทำชุด HTML นิ่ง)
