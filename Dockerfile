# ── Stage 1: Build SkeldJS from source ──
FROM node:22-alpine AS skeldjs-builder

WORKDIR /skeldjs
RUN apk add --no-cache git

# Clone the SkeldJS fork
ARG SKELDJS_REPO=https://github.com/Empostor/SkeldJS
ARG SKELDJS_BRANCH=main
RUN git clone --depth 1 --branch ${SKELDJS_BRANCH} ${SKELDJS_REPO} .

# Install dependencies & build all packages
RUN corepack enable && yarn install
RUN yarn build

# ── Stage 2: Build Waterway with local SkeldJS ──
FROM node:22-alpine AS builder

WORKDIR /app

# Copy SkeldJS built packages from previous stage
COPY --from=skeldjs-builder /skeldjs/packages /skeldjs/packages
COPY --from=skeldjs-builder /skeldjs/package.json /skeldjs/
COPY --from=skeldjs-builder /skeldjs/tsconfig.json /skeldjs/

# Copy Waterway source
COPY package.json tsconfig.json .yarnrc.yml ./
COPY .yarn/ .yarn/
COPY bin/ bin/
COPY src/ src/

# Enable yarn
RUN corepack enable

# Rewrite @skeldjs dependencies to use local linked packages
# This replaces npm registry deps with file: references to the locally built SkeldJS
RUN sed -i \
    -e 's|"@skeldjs/au-client": "[^"]*"|"@skeldjs/au-client": "link:/skeldjs/packages/client"|' \
    -e 's|"@skeldjs/au-constants": "[^"]*"|"@skeldjs/au-constants": "link:/skeldjs/packages/constant"|' \
    -e 's|"@skeldjs/au-core": "[^"]*"|"@skeldjs/au-core": "link:/skeldjs/packages/core"|' \
    -e 's|"@skeldjs/au-protocol": "[^"]*"|"@skeldjs/au-protocol": "link:/skeldjs/packages/protocol"|' \
    -e 's|"@skeldjs/au-text": "[^"]*"|"@skeldjs/au-text": "link:/skeldjs/packages/text"|' \
    -e 's|"@skeldjs/events": "[^"]*"|"@skeldjs/events": "link:/skeldjs/packages/events"|' \
    -e 's|"@skeldjs/hazel": "[^"]*"|"@skeldjs/hazel": "link:/skeldjs/packages/hazel"|' \
    package.json

# Install and build Waterway
RUN yarn install
RUN yarn build

# ── Stage 3: Production image ──
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/

EXPOSE 22023 22123

CMD ["node", "dist/bin/bootstrap"]
