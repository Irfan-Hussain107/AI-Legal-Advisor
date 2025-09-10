FROM node:18-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    poppler-utils \
    imagemagick \
    ghostscript \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 5001

CMD [ "node", "server.js" ]