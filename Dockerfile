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

# Install ca-certificates for potential SSL/external requests
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
