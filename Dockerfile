##### Stage 1: Build DiscOS #####

FROM node:lts-trixie-slim AS build

WORKDIR /discos

COPY package*.json ./

# Install build tools for node-pty
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    python3 g++ make >/dev/null \
    sudo bash ca-certificates \
    && rm -rf /var/lib/apt/lists/* && apt-get clean

RUN npm ci --omit=optional --silent

COPY . .

RUN npm run build

##### Stage 2: Production #####

FROM node:lts-trixie-slim

WORKDIR /discos

ENV NODE_ENV=production

RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
    sudo bash ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled artifacts
COPY --from=build /discos/node_modules ./node_modules
COPY --from=build /discos/dist ./dist
COPY package*.json ./

CMD ["node", "dist/startup.js"]