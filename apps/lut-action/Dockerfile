# Single container Dockerfile
FROM node:20-alpine

# Install dependencies including FFmpeg
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    curl \
    tini \
    bash \
    && rm -rf /var/cache/apk/*

# Verify FFmpeg installation
RUN ffmpeg -version && \
    ffmpeg -filters 2>/dev/null | grep -q lut3d && \
    echo "FFmpeg with lut3d filter installed successfully"

# Create app directory and set permissions
RUN mkdir -p /app /tmp/archon-lut \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 \
    && chown -R nodejs:nodejs /app /tmp/archon-lut

WORKDIR /app

# Copy package files
COPY --chown=nodejs:nodejs package*.json ./

# Install dependencies
RUN npm ci --include=dev \
    && npm cache clean --force

# Copy source code
COPY --chown=nodejs:nodejs . .

# Copy LUTs directory if it exists (for pre-loaded LUTs)
COPY --chown=nodejs:nodejs luts /app/luts/

# Copy entrypoint script
COPY --chown=nodejs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Build TypeScript
RUN npm run build

# Import LUTs during build phase (before removing dev dependencies)
RUN if [ -d "/app/luts" ]; then \
      echo "Importing LUTs during build..." && \
      npx tsx scripts/importLUTs.ts /app/luts && \
      echo "LUTs imported successfully"; \
    fi

# Remove dev dependencies after build AND LUT import
RUN npm prune --production

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use tini as entrypoint to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Use our custom entrypoint script that imports LUTs before starting
CMD ["/app/docker-entrypoint.sh"]