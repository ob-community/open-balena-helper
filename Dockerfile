FROM node:22-bookworm-slim

EXPOSE 80

WORKDIR /usr/src/app

COPY . .

RUN npm ci --no-fund --no-update-notifier && \
    tsc

CMD ["/bin/sh", "/usr/src/app/start.sh"]