##### Stage 1: Build DiscOS #####

FROM node:lts-alpine AS build

WORKDIR /discos

COPY package*.json ./

# Avoid running husky postinstall scripts
RUN npm ci --ignore-scripts --silent

COPY . .

RUN npm run build

##### Stage 2: Production #####

FROM node:lts-alpine

WORKDIR /discos

COPY package*.json ./

ENV NODE_ENV=production

RUN npm ci --omit=dev --omit=optional --silent

COPY --from=build /discos/dist ./dist

CMD ["node", "dist/startup.js"]