const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, './')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let players = {};

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Отправляем новому игроку список существующих
  socket.emit('currentPlayers', players);

  // Создаем нового игрока
  players[socket.id] = {
    x: 20, y: 18, angle: 0, pitch: 0, color: '#' + Math.floor(Math.random()*16777215).toString(16)
  };

  // Сообщаем всем о новом игроке
  socket.broadcast.emit('newPlayer', { id: socket.id, ...players[socket.id] });

  // Обновление позиции
  socket.on('playerMovement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      players[socket.id].pitch = data.pitch;
      socket.broadcast.emit('playerMoved', { id: socket.id, ...players[socket.id] });
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});