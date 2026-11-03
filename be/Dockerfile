
FROM node:24-bookworm-slim AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]


FROM development AS build
RUN npm run build
RUN npm prune --omit=dev


FROM node:24-bookworm-slim AS production

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
