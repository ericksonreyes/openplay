FROM node:22-alpine

WORKDIR /app
EXPOSE 3003
CMD ["npm", "run", "dev"]
