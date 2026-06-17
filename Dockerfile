# صورة Docker لنشر النظام (الخادم + الواجهة) على Google Cloud Run.
# يُبنى من جذر المشروع: سياق البناء يحوي مجلدي server/ و public/.
FROM node:20-slim

WORKDIR /app

# تثبيت اعتماديات الخادم أولاً (للاستفادة من طبقات الكاش)
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# نسخ كود الخادم والواجهة
COPY server/ ./server/
COPY public/ ./public/

ENV NODE_ENV=production
# Cloud Run يمرّر المنفذ عبر متغيّر PORT (افتراضياً 8080)
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/server
CMD ["node", "src/index.js"]
