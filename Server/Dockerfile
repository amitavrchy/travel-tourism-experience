FROM node:22-alpine AS build
WORKDIR /app/Server
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY src ./src
COPY tsconfig*.json nest-cli.json ./
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-alpine
WORKDIR /app/Server
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
COPY --from=build /app/Server/node_modules ./node_modules
COPY --from=build /app/Server/dist ./dist
COPY package.json ./
COPY data /app/Server/data
RUN mkdir .data && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
