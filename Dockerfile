# Stage 1: Build the Vite application
FROM node:22-bullseye-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application and copy alphaTab assets needed by the Vite-generated worker files
RUN npm run build && \
    mkdir -p /app/dist/alphatab && \
    cp -r node_modules/@coderline/alphatab/dist/* /app/dist/alphatab/ && \
    cp node_modules/@coderline/alphatab/dist/alphaTab.core.mjs /app/dist/assets/ && \
    cp node_modules/@coderline/alphatab/dist/alphaTab.core.min.mjs /app/dist/assets/ && \
    cp node_modules/@coderline/alphatab/dist/alphaTab.worklet.mjs /app/dist/assets/ && \
    cp node_modules/@coderline/alphatab/dist/alphaTab.worklet.min.mjs /app/dist/assets/

# Stage 2: Serve with NGINX
FROM nginx:alpine

# Copy the custom NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose the web port
EXPOSE 8080

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
