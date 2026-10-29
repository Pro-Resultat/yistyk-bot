FROM alpine:latest

# Устанавливаем Node.js, NPM и Chromium с необходимыми системными библиотеками
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    npm

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install

COPY . .

# Указываем Puppeteer использовать установленный в системе Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
