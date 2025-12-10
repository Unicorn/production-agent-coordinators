# Build stage
FROM rust:1.81-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files for dependency caching
COPY Cargo.toml Cargo.lock* ./

# Create a dummy src/main.rs to build dependencies
RUN mkdir src && \
    echo 'fn main() { println!("placeholder"); }' > src/main.rs && \
    echo 'pub fn placeholder() {}' > src/lib.rs

# Build dependencies (this layer will be cached)
RUN cargo build --release && rm -rf src

# Copy actual source code
COPY src ./src

# Build the application
RUN touch src/main.rs src/lib.rs && \
    cargo build --release

# Runtime stage
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# Install runtime dependencies (OpenSSL and Node.js for verification)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for TypeScript verification
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -ms /bin/bash appuser
USER appuser

# Copy the binary from builder
COPY --from=builder /app/target/release/workflow-compiler /app/workflow-compiler

# Environment variables
ENV PORT=3020
ENV RUST_LOG=workflow_compiler=info,tower_http=info
ENV VERIFICATION_TIMEOUT=30
ENV STRICT_MODE=true

# Expose port
EXPOSE 3020

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3020/health || exit 1

# Run the application
CMD ["/app/workflow-compiler"]
