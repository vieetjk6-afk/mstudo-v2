# Bộ hẹn giờ của máy chủ ở nhà: Alpine + crond (busybox) + curl + jq. ~10 MB.
# Chỉ làm một việc: tới giờ thì gọi một route /api/cron/* của container `app`
# kèm "Authorization: Bearer $CRON_SECRET". Không chứa mã của app.
FROM alpine:3.20
RUN apk add --no-cache curl jq tzdata util-linux-misc
COPY crontab /etc/crontabs/root
COPY khoi-dong.sh goi-cron.sh quet-khuon-mat.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/*.sh && chmod 0600 /etc/crontabs/root
ENTRYPOINT ["/usr/local/bin/khoi-dong.sh"]
