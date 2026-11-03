

FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund

# Development environment
FROM dependencies AS development

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# Production build (requires frontend source)
FROM dependencies AS builder

COPY . .

RUN npm run build


# Production runtime
FROM nginx:stable-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
