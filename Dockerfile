FROM denoland/deno:alpine-2.3.3

WORKDIR /app

COPY . .

RUN deno cache src/main.ts
RUN apk add monolith yt-dlp

ENV SERVER_PORT=80
ENV DENO_DIR=/deno-dir
RUN mkdir -p /deno-dir

VOLUME ["/app/data"]
ENTRYPOINT deno task migrate && deno task start