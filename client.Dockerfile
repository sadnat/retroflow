FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY client/package*.json ./client/

# Install dependencies
WORKDIR /app/client
RUN npm install

# Copy source
WORKDIR /app
COPY shared ./shared
COPY client ./client

WORKDIR /app/client

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
