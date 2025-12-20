# Build stage
# Build stage
FROM node:18-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /app
COPY package*.json ./
# Install only production dependencies
RUN npm install --only=production

COPY --from=builder /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
