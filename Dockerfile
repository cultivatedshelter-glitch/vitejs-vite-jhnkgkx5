FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json requirements-phase1.txt ./
RUN npm ci --omit=dev \
  && python3 -m venv /opt/shelter-prep-venv \
  && /opt/shelter-prep-venv/bin/pip install --no-cache-dir -r requirements-phase1.txt
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV SHELTER_PREP_PYTHON=/opt/shelter-prep-venv/bin/python3
EXPOSE 8080
CMD ["npm", "start"]
