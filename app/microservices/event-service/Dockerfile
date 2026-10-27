FROM node:22-bookworm-slim

WORKDIR /app
COPY app/microservices/event-service/package*.json ./
RUN npm ci
COPY app/microservices/event-service ./

ENV NODE_ENV=production
ENV PORT=4102
EXPOSE 4102

USER node
CMD ["npm", "run", "start"]
