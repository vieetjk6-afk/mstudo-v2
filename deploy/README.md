# deploy/ — chạy mstudo trên VPS

Hướng dẫn đầy đủ từng bước: **[`../docs/chuyen-sang-vps.md`](../docs/chuyen-sang-vps.md)**.
File này chỉ là bảng tra nhanh khi đã dựng xong.

## Có gì trong đây

| File | Chạy ở đâu | Việc |
|---|---|---|
| `setup-vps.sh` | VPS, root, **một lần** | Swap 4GB, user `mstudo`, tường lửa, fail2ban, Node 22, pm2, Caddy |
| `Caddyfile` | chép sang `/etc/caddy/Caddyfile` | Web server + HTTPS tự động (kể cả tên miền riêng của studio) |
| `ecosystem.config.cjs` | VPS, do pm2 đọc | Giữ app sống, 1 tiến trình, trần RAM |
| `activate.sh` | VPS, do CI gọi | Đổi sang bản mới, reload, kiểm tra, tự quay lui nếu hỏng |
| `crontab.txt` | VPS, `crontab <file>` | 5 job thay cho `vercel.json` |
| `cron-run.sh` | VPS, do cron gọi | Chạy 1 job + ghi log `~/logs/cron.log` |
| `backup-db.sh` | VPS, do cron gọi | `pg_dump` — chỉ dùng khi đã tự dựng Supabase |
| `env.vps.example` | mẫu cho `/var/www/mstudo/shared/.env` | Biến môi trường |

## Bố trí trên VPS

```
/var/www/mstudo/
├── releases/
│   ├── 20260817-093000-a1b2c3d/     ← bản đang chạy
│   ├── 20260816-141500-9f8e7d6/     ← bản trước (để quay lui)
│   └── 20260815-102200-5c4b3a2/
├── shared/
│   └── .env                          ← bí mật, KHÔNG bị deploy ghi đè
└── current -> releases/20260817-...  ← symlink, pm2 chạy từ đây

/home/mstudo/logs/     out.log, error.log, cron.log
/etc/caddy/Caddyfile
```

## Lệnh hay dùng

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@<IP>

pm2 list                      # app còn sống?
pm2 logs mstudo --lines 100   # lỗi gì?
pm2 reload mstudo             # khởi động lại, không đứt kết nối
pm2 monit                     # RAM/CPU theo thời gian thực

free -h                       # RAM + swap
df -h /                       # ổ đĩa
tail -50 ~/logs/cron.log      # cron có lỗi không

sudo systemctl reload caddy
sudo journalctl -u caddy -n 50
curl -s localhost:3000/api/health
```

## Deploy

Push lên `main` → GitHub Actions tự build và đẩy sang VPS.
Deploy tay: Actions → **Deploy to VPS** → Run workflow.

## Quay lui

`activate.sh` tự quay lui khi bản mới không phản hồi trong 60 giây. Thủ công:

```bash
ls -1t /var/www/mstudo/releases
/var/www/mstudo/releases/<ban-cu>/deploy/activate.sh <ban-cu>
```

## Đổi biến môi trường

```bash
sudo -u mstudo nano /var/www/mstudo/shared/.env
pm2 reload mstudo --update-env      # không có bước này thì app vẫn giá trị cũ
```

## Ba cái bẫy hay gặp nhất

1. **Quên tắt Cron Jobs trên Vercel** → khách nhận 2 email và 2 tin Zalo mỗi
   ngày. Tắt trong Vercel → Settings → Cron Jobs.
2. **Cloudflare bật proxy (đám mây cam)** → Caddy không xin được chứng chỉ.
   Để **DNS only** cho tới khi mọi thứ chạy.
3. **Quên `SERVER_IP` trong `.env`** → tính năng tên miền riêng của studio
   không xác minh được sau khi rời Vercel.
