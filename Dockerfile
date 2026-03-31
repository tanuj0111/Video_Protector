FROM node:20

# FFmpeg install karo
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

# Poora code pehle copy karo
COPY . .

# Build karo
RUN npm run build

EXPOSE 8080

CMD ["node", "backend/server.js"]