FROM node:24.13.0-alpine AS ui-builder

RUN mkdir /app \
    && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml /app/

RUN apk add --update --no-cache g++ make git \
    && pnpm install --frozen-lockfile \
    && apk del g++ make

ARG VITE_CF_ACCESS_CLIENT_ID
ARG VITE_CF_ACCESS_CLIENT_SECRET
ENV VITE_CF_ACCESS_CLIENT_ID=$VITE_CF_ACCESS_CLIENT_ID
ENV VITE_CF_ACCESS_CLIENT_SECRET=$VITE_CF_ACCESS_CLIENT_SECRET

COPY . /app

RUN pnpm run build

FROM nginx:1.29.8-alpine
COPY  --from=ui-builder /app/dist /etc/nginx/html
COPY  --from=ui-builder /app/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx"]
