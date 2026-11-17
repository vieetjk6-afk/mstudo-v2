# Triển khai tự động: kiểm thử trước khi deploy + tự chạy SQL

Mỗi lần gộp code vào `main`, GitHub Actions làm ba việc theo thứ tự. Việc nào
hỏng thì dừng ở đó — bản đang chạy trên mstudo.com không bị đụng tới.

| Bước | Làm gì | Hỏng thì |
|---|---|---|
| 1. Kiểm thử | Chạy cả bộ `npm test` (hơn trăm bài, ~3–5 phút) | Không build, không deploy |
| 2. Build | `vercel build` (kiểm kiểu + build) | Không chạy SQL, không deploy |
| 3. Tự chạy SQL | `supabase/cap-nhat.sql` có thay đổi thì chạy lên database | Rollback toàn bộ, không deploy |
| 4. Deploy | Đưa bản mới lên mstudo.com | — |

Pull request nào cũng được chạy kiểm thử + kiểm kiểu + lint (workflow **Kiểm thử**).

## Việc anh/chị cần làm MỘT lần: thêm secret `SUPABASE_DB_URL`

Chưa có secret này thì bước 3 tự bỏ qua (có cảnh báo vàng trong log) và SQL vẫn
phải dán tay vào SQL Editor như trước. Có rồi thì không bao giờ phải dán nữa.

1. Supabase → mở project → nút **Connect** (trên cùng).
2. Chọn **Session pooler** (cổng `5432`). **Không** dùng *Direct connection*:
   máy chạy của GitHub không có IPv6 nên không nối được.
3. Chép chuỗi dạng
   `postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
   và thay `[YOUR-PASSWORD]` bằng mật khẩu database (quên thì đặt lại ở
   Project Settings → Database → *Reset database password*).
4. GitHub → repo → **Settings → Secrets and variables → Actions → New repository
   secret**: tên `SUPABASE_DB_URL`, giá trị là chuỗi vừa chép.

Chuỗi này có toàn quyền trên database — chỉ để trong GitHub Secrets, không dán
vào đâu khác. Script không bao giờ in mật khẩu ra log.

## Bước tự chạy SQL làm đúng những gì

`scripts/chay-sql.mjs` làm y hệt việc dán `cap-nhat.sql` vào SQL Editor, không hơn:

- Chỉ chạy khi **nội dung** `cap-nhat.sql` khác lần chạy thành công gần nhất (so
  mã sha256, ghi ở bảng `system_runs`). Deploy không có SQL mới thì không đụng
  database.
- Chạy cả file trong **một transaction, gửi đi một lượt**: hỏng một câu là
  rollback hết, database y nguyên. Khoá bảng chỉ giữ một hai giây.
- Chờ khoá tối đa 10 giây rồi bỏ cuộc (không treo hệ thống sau một câu ALTER).
- Lần đầu tiên bật, nó chạy nguyên `cap-nhat.sql` một lần (vô hại — file này
  chạy lại bao nhiêu lần cũng được) rồi ghi dấu.
- Kết quả mỗi lần chạy hiện ở trang Admin → Hệ thống → **Sức khoẻ hệ thống**.

Tự xem có SQL mới chưa chạy hay không (không chạy gì):

```
SUPABASE_DB_URL=postgresql://… node scripts/chay-sql.mjs --kiem-tra
```

## Khi bị chặn

- **Kiểm thử đỏ**: mở lượt chạy trong tab Actions, cuối log có tên bài hỏng và
  60 dòng cuối của nó. Chạy lại ở máy: `npm test -- <tên-bài>`.
- **SQL hỏng**: log in câu lỗi của Postgres kèm số dòng trong `cap-nhat.sql`.
  Database đã rollback, không cần dọn gì. Sửa migration → `node
  supabase/build-setup-all.mjs` → gộp lại.
- **Cần lên gấp**: tab Actions → *Deploy production (Vercel)* → **Run workflow**
  → tích *Bỏ qua kiểm thử* và/hoặc *Không tự chạy SQL lượt này*.

## Cho người viết code

- `npm test` chạy mọi script `test:*` trong `package.json` (4 bài cùng lúc).
  `npm test -- face` chỉ chạy bài có chữ "face"; `--tuan-tu` chạy từng bài.
- Bài cần Postgres thật dùng `desktop/test/pg-tam.mjs` (mỗi bài một cổng riêng).
  Trên CI các bài này không được phép "bỏ qua" — thêm tên vào `--khong-bo-qua`
  trong `.github/workflows/kiem-thu.yml`.
- Migration mới: thêm vào `ORDER` và `MOI` trong `supabase/build-setup-all.mjs`
  rồi chạy script đó. Viết sao cho **chạy lại được** và **bản code cũ vẫn chạy
  được** trên database mới (chỉ thêm bảng / cột / hàm; đừng xoá hay đổi tên cột
  trong cùng lượt deploy với code còn dùng nó) — SQL lên trước code vài chục giây.
