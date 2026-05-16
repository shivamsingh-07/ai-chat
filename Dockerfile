# Stage-1: Install production dependencies (no devDependencies, locked versions).
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production --silent

# Stage-2: Run the application as the unprivileged `node` user.
FROM node:24-alpine

WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules

COPY --chown=node:node . .

USER node

EXPOSE 5000

CMD ["node", "server.js"]
