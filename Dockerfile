FROM node:carbon

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
RUN npm install forever -g

COPY . .

EXPOSE 4000

CMD ["forever", "index.js"]