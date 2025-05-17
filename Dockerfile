FROM denoland/deno:alpine-2.3.3

WORKDIR /app

COPY . .
RUN deno cache src/main.ts
ENV SERVER_PORT=80

VOLUME ["/app/data"]
CMD ["deno", "task", "start"]