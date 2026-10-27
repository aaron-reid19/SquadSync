FROM node:22-bookworm-slim

WORKDIR /app
COPY app/microservices/squad-service/package*.json ./
RUN npm ci
COPY app/microservices/squad-service ./

ENV NODE_ENV=production
ENV PORT=4101
EXPOSE 4101

USER node
CMD ["npm", "run", "start"]
