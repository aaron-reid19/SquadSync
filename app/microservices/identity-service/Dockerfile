FROM node:22-bookworm-slim

WORKDIR /app
COPY app/microservices/identity-service/package*.json ./
RUN npm ci
COPY app/microservices/identity-service ./

ENV NODE_ENV=production
ENV PORT=4100
EXPOSE 4100

USER node
CMD ["npm", "run", "start"]
