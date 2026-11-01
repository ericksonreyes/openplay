FROM node:22-alpine

WORKDIR /app
EXPOSE 3002
CMD ["npm", "run", "dev"]
