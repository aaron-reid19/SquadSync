FROM node:22-bookworm-slim

WORKDIR /app
COPY app/microservices/api-gateway/package*.json ./
RUN npm ci
COPY app/microservices/api-gateway ./

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

USER node
CMD ["npm", "run", "start"]
