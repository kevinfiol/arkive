# archive

A single-user personal web archive tool powered by [monolith](https://github.com/Y2Z/monolith).

![screenshot of arkive](https://github.com/user-attachments/assets/76e15f5b-f9c0-4b08-a935-9f829543f85f)

## Setup

The easiest way to get started is to clone the repository and stand up an instance using Docker Compose.

```bash
git clone https://github.com/kevinfiol/arkive.git arkive
cd arkive
cp .env.defaults .env # make sure to set SESSION_SECRET
docker compose up -d
```

## Development

Install [Deno](https://deno.com/).

```bash
# run db migrations
deno task migrate

# run application
deno task start

# run in dev mode
deno task dev
```