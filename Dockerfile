# 构建：docker build -t tutorial-site .
# 运行：docker run -d -p 4321:4321 -v tutorial-data:/data \
#         -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你的密码' tutorial-site
FROM node:22-slim AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 DATA_DIR=/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
VOLUME /data
EXPOSE 4321
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server/entry.mjs"]
