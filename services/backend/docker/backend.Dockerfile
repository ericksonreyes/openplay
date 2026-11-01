FROM node:22-alpine

WORKDIR /app
EXPOSE 8000
CMD ["npm", "run", "dev"]
