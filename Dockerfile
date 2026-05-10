# Stage-1: Install dependencies
FROM node:lts-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --silent

# Stage-2: Run the application
FROM node:lts-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY . .

EXPOSE 5000

CMD ["yarn", "start"]
