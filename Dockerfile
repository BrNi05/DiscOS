##### Stage 1: Build DiscOS #####

FROM node:lts-alpine AS build

# Set NODE_ENV to production (to avoid running husky postinstall scripts)
ENV NODE_ENV=production

WORKDIR /discos

COPY package*.json ./

RUN npm ci

COPY . .

RUN rm -f tsconfig.tsbuildinfo && npm run build

##### Stage 2: Production #####

FROM node:lts-alpine

WORKDIR /discos

COPY package*.json ./

RUN npm ci --omit=dev --no-optional

COPY --from=build /discos/dist ./dist

CMD ["node", "dist/startup.js"]