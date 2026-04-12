FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod --ignore-scripts

COPY db ./db
COPY src ./src
COPY static ./static

EXPOSE 3000

CMD ["node", "src/server.ts"]
