FROM node:22-bookworm-slim

WORKDIR /app
COPY app/microservices/notification-worker/package*.json ./
RUN npm ci
COPY app/microservices/notification-worker ./

ENV NODE_ENV=production
ENV PORT=4104
EXPOSE 4104

USER node
CMD ["npm", "run", "start"]
