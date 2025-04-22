# Use official Node.js image with Debian slim
FROM node:22-slim

# Create app directory
WORKDIR /app

# Install dependencies early (for caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Optional: Set Node.js environment vars
ENV NODE_ENV=prod
ENV PORT=8080

# Start the bot
CMD ["npm", "start"]
