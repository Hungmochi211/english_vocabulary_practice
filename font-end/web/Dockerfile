# Stage 1: Build Vite React app
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_ENABLE_MSW=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_ENABLE_MSW=$VITE_ENABLE_MSW

COPY index.html vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src
COPY tests ./tests
RUN npm run build

# Stage 2: Serve static files via Nginx
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
