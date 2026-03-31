FROM node:20

# FFmpeg install karo
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

# Dependencies install karo
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm run build

# Poora code copy karo
COPY . .

RUN cd backend && npm install

EXPOSE 8080

CMD ["node", "backend/server.js"]