FROM node:18-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    poppler-utils \
    imagemagick \
    ghostscript \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml || true
RUN sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-7/policy.xml || true
RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' /etc/ImageMagick-6/policy.xml || true

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5001
CMD [ "node", "server.js" ]