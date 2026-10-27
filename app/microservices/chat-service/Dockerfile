FROM node:22-bookworm-slim

WORKDIR /app
COPY app/microservices/chat-service/package*.json ./
RUN npm ci
COPY app/microservices/chat-service ./

ENV NODE_ENV=production
ENV PORT=4103
EXPOSE 4103

USER node
CMD ["npm", "run", "start"]
