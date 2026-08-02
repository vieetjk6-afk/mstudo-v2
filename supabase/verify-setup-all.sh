#!/usr/bin/env bash
# Chạy thử supabase/setup-all.sql trên một PostgreSQL trắng ở máy, MÔ PHỎNG
# đúng cách Supabase SQL Editor chạy: cả file trong MỘT transaction, gặp lỗi là
# rollback sạch. Bắt được lỗi thứ tự (policy/cột tham chiếu bảng chưa tồn tại)
# trước khi dán lên Supabase thật.
#
#   bash supabase/verify-setup-all.sh
#
# Cần: PostgreSQL 16 ở máy (Ubuntu: apt install postgresql-16).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/var/tmp/mstudo-verify-pg}"
PORT="${PORT:-55432}"
DB=verify_setup_all

[ -x "$PGBIN/initdb" ] || { echo "Không thấy PostgreSQL ở $PGBIN — đặt biến PGBIN cho đúng."; exit 1; }

node "$HERE/build-setup-all.mjs"

# Cụm database tạm, dựng mới mỗi lần chạy cho sạch.
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  rm -rf "$PGDATA"; mkdir -p "$PGDATA"
  if [ "$(id -u)" = "0" ]; then chown postgres:postgres "$PGDATA"; chmod 700 "$PGDATA"; fi
  RUN() { if [ "$(id -u)" = "0" ]; then su postgres -c "$1"; else bash -c "$1"; fi; }
  RUN "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
  RUN "$PGBIN/pg_ctl -D $PGDATA -l $PGDATA/log -o '-p $PORT -k /tmp' -w start" >/dev/null
else
  RUN() { if [ "$(id -u)" = "0" ]; then su postgres -c "$1"; else bash -c "$1"; fi; }
  RUN "$PGBIN/pg_ctl -D $PGDATA -o '-p $PORT -k /tmp' -w start" >/dev/null 2>&1 || true
fi

PSQL="psql -h /tmp -p $PORT -U postgres -q -v ON_ERROR_STOP=1"
$PSQL -c "drop database if exists $DB;" -c "create database $DB;" >/dev/null
$PSQL -d $DB -f "$HERE/test/supabase-stubs.sql" >/dev/null 2>&1

echo "── Lần 1 (database trắng) ────────────────────────────────"
$PSQL -d $DB --single-transaction -f "$HERE/setup-all.sql"
echo "   OK"
echo "── Lần 2 (chạy lại phải vô hại) ──────────────────────────"
$PSQL -d $DB --single-transaction -f "$HERE/setup-all.sql"
echo "   OK"

Q="psql -h /tmp -p $PORT -U postgres -d $DB -tA -c"
echo "── Kết quả ───────────────────────────────────────────────"
echo "   bảng public : $($Q "select count(*) from information_schema.tables where table_schema='public';")"
echo "   policy      : $($Q "select count(*) from pg_policies where schemaname='public';")"
echo "   bucket      : $($Q "select string_agg(id,', ' order by id) from storage.buckets;")"
echo "   trigger tạo profile: $($Q "select count(*) from pg_trigger where tgname='on_auth_user_created';")"
echo
echo "Dọn dẹp:  $PGBIN/pg_ctl -D $PGDATA stop && rm -rf $PGDATA"
