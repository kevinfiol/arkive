FROM denoland/deno:alpine-2.3.3

WORKDIR /app

COPY . .

RUN deno cache src/main.ts
RUN apk update && apk add --no-cache monolith yt-dlp

ENV SERVER_PORT=80
ENV LD_LIBRARY_PATH=/usr/lib:/usr/local/lib
ENV DENO_DIR=/deno-dir
RUN mkdir -p /deno-dir

VOLUME ["/app/data"]
ENTRYPOINT deno task migrate && deno task start