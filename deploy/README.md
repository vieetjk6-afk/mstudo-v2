# deploy/ — chạy mstudo trên VPS

Hướng dẫn đầy đủ từng bước (kể cả cách chọn VPS):
**[`../docs/chuyen-sang-vps.md`](../docs/chuyen-sang-vps.md)**.
File này là bảng tra nhanh khi đã dựng xong.

## Phương án

**VPS 2GB · Ubuntu 24.04 LTS · Caddy · systemd · build trên GitHub Actions**

Không dùng Docker, không dùng pm2, không dùng PaaS — với một ứng dụng thì đó
chỉ là thêm tầng phức tạp và thêm RAM bị chiếm.

## Có gì trong đây

| File | Chạy ở đâu | Việc |
|---|---|---|
| `setup-vps.sh` | VPS, root, **một lần** | Swap, user `mstudo`, tường lửa, fail2ban, siết SSH, Node 22, Caddy, systemd, cập nhật tự động |
| `Caddyfile` | chép sang `/etc/caddy/Caddyfile` | Web server + HTTPS tự động (kể cả tên miền riêng của studio) |
| `mstudo.service` | chép sang `/etc/systemd/system/` | Giữ app sống, trần RAM, siết quyền |
| `activate.sh` | VPS, user `mstudo`, do CI gọi | Đổi sang bản mới, kiểm tra, tự quay lui |
| `crontab.txt` | VPS, `crontab <file>` | 5 job thay cho `vercel.json` |
| `cron-run.sh` | VPS, do cron gọi | Chạy 1 job + ghi log `~/logs/cron.log` |
| `backup-db.sh` | VPS, do cron gọi | `pg_dump` — chỉ dùng khi đã tự dựng Supabase |
| `env.vps.example` | mẫu cho `/var/www/mstudo/shared/.env` | Biến môi trường |

## Bố trí trên VPS

```
/var/www/mstudo/
├── releases/
│   ├── 20260817-093000-a1b2c3d/     ← bản đang chạy (~55MB)
│   ├── 20260816-141500-9f8e7d6/     ← bản trước (để quay lui)
│   └── 20260815-102200-5c4b3a2/
├── shared/
│   └── .env                          ← bí mật, deploy KHÔNG ghi đè
└── current -> releases/20260817-...  ← symlink, systemd chạy từ đây

/home/mstudo/logs/cron.log
/etc/systemd/system/mstudo.service
/etc/caddy/Caddyfile
```

## Lệnh hay dùng

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@<IP>

systemctl status mstudo          # còn sống không
journalctl -u mstudo -f          # log trực tiếp
journalctl -u mstudo -n 200      # 200 dòng gần nhất
sudo systemctl restart mstudo    # khởi động lại

free -h                          # RAM + swap
df -h /                          # ổ đĩa
systemctl show mstudo -p MemoryCurrent    # app ăn bao nhiêu RAM
tail -50 ~/logs/cron.log

journalctl -u caddy -n 50
curl -s localhost:3000/api/health
```

## Deploy

Push lên `main` → GitHub Actions tự build và đẩy sang VPS.
Deploy tay: Actions → **Deploy to VPS** → Run workflow.

Deploy **không gián đoạn**: app boot ~76ms và Caddy giữ request tới 15 giây
(`lb_try_duration`), nên khách không thấy gì.

## Quay lui

`activate.sh` tự quay lui khi bản mới không phản hồi trong 60 giây. Thủ công:

```bash
ls -1t /var/www/mstudo/releases
/var/www/mstudo/releases/<bản-cũ>/deploy/activate.sh <bản-cũ>
```

## Đổi biến môi trường

```bash
nano /var/www/mstudo/shared/.env
sudo systemctl restart mstudo
```

`.env` do **systemd** đọc, không phải bash: không dấu cách quanh `=`, không
`export`, không nội suy `$`. `activate.sh` tự kiểm tra và từ chối deploy nếu sai.

## Sửa mstudo.service

`activate.sh` cố ý **không** tự cập nhật unit file — cho phép nghĩa là ai đẩy
được code cũng sửa được thành `ExecStart=/bin/sh` rồi leo lên root. Làm tay:

```bash
sudo cp /var/www/mstudo/current/deploy/mstudo.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl restart mstudo
```

## Điều chỉnh theo RAM của máy

Sửa trong `mstudo.service`:

| RAM VPS | `NODE_OPTIONS` | `MemoryHigh` | `MemoryMax` |
|---|---|---|---|
| 1 GB | `--max-old-space-size=384` | `450M` | `600M` |
| **2 GB** | `--max-old-space-size=768` | `900M` | `1200M` |
| 4 GB | `--max-old-space-size=1536` | `1800M` | `2400M` |

## Bốn cái bẫy hay gặp nhất

1. **Quên tắt Cron Jobs trên Vercel** → khách nhận 2 email và 2 tin Zalo mỗi
   ngày. Tắt trong Vercel → Settings → Cron Jobs.
2. **Cloudflare bật proxy (đám mây cam)** → Caddy không xin được chứng chỉ.
   Để **DNS only** cho tới khi mọi thứ chạy.
3. **Quên `SERVER_IP` trong `.env`** → tính năng tên miền riêng của studio
   không xác minh được sau khi rời Vercel.
4. **Đóng cửa sổ SSH ngay sau `setup-vps.sh`** → script đã tắt đăng nhập bằng
   mật khẩu. Mở cửa sổ mới thử `ssh mstudo@<IP>` trước khi đóng cửa sổ cũ.
