# Stage-1: Install production dependencies (no devDependencies, locked versions).
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production --silent

# Stage-2: Run the application as the unprivileged `node` user.
FROM node:24-alpine

WORKDIR /app

# Runtime only needs the node binary. Drop bundled npm/corepack so Trivy
# does not fail the image on HIGH/CRITICAL CVEs in npm's nested deps
RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack

COPY --from=builder --chown=node:node /app/node_modules ./node_modules

COPY --chown=node:node app ./app
COPY --chown=node:node server.js ./

USER node

EXPOSE 5000

CMD ["node", "server.js"]
