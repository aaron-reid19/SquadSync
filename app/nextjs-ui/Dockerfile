FROM node:22-alpine AS dependencies

WORKDIR /workspace
COPY app/nextjs-ui/package*.json app/nextjs-ui/
RUN npm ci --prefix app/nextjs-ui

FROM dependencies AS builder
COPY app/nextjs-ui app/nextjs-ui
RUN npm run build --prefix app/nextjs-ui

FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=builder /workspace/app/nextjs-ui/.next/standalone ./
COPY --from=builder /workspace/app/nextjs-ui/.next/static ./.next/static
COPY --from=builder /workspace/app/nextjs-ui/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
