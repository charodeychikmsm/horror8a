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

let rooms = {}; // Хранилище лобби

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Создание лобби
  socket.on('createLobby', () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4-значный код
    rooms[code] = {
      host: socket.id,
      players: {},
      difficulty: 'normal',
      started: false
    };
    socket.join(code);
    socket.roomCode = code;
    socket.emit('lobbyCreated', code);
  });

  // Вход в лобби
  socket.on('joinLobby', (code) => {
    if(rooms[code] && !rooms[code].started) {
      socket.join(code);
      socket.roomCode = code;
      socket.emit('lobbyJoined', code);
      
      // Отправляем хосту уведомление о новом игроке
      io.to(rooms[code].host).emit('updatePlayers', Object.keys(rooms[code].players).length + 1);
    } else {
      socket.emit('lobbyError', 'Лобби не найдено или игра уже началась!');
    }
  });

  // Смена сложности (только хост)
  socket.on('changeDifficulty', (diff) => {
    if(rooms[socket.roomCode]) {
      rooms[socket.roomCode].difficulty = diff;
      io.to(socket.roomCode).emit('difficultyChanged', diff);
    }
  });

  // Начало игры
  socket.on('startGame', () => {
    if(rooms[socket.roomCode] && rooms[socket.roomCode].host === socket.id) {
      rooms[socket.roomCode].started = true;
      
      let pColor = '#' + Math.floor(Math.random()*16777215).toString(16);
      rooms[socket.roomCode].players[socket.id] = {
        x: 20, y: 16, angle: 0, pitch: 0, color: pColor, isMoving: false
      };
      
      io.to(socket.roomCode).emit('gameStarted', {
        difficulty: rooms[socket.roomCode].difficulty,
        players: rooms[socket.roomCode].players
      });
    }
  });

  // Обновление позиции
  socket.on('playerMovement', (data) => {
    const room = rooms[socket.roomCode];
    if(room && room.players[socket.id]) {
      room.players[socket.id].x = data.x;
      room.players[socket.id].y = data.y;
      room.players[socket.id].angle = data.angle;
      room.players[socket.id].pitch = data.pitch;
      room.players[socket.id].isMoving = data.isMoving;
      
      socket.to(socket.roomCode).emit('playerMoved', { id: socket.id, ...data });
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    if(socket.roomCode && rooms[socket.roomCode]) {
      delete rooms[socket.roomCode].players[socket.id];
      socket.to(socket.roomCode).emit('playerDisconnected', socket.id);
      
      if(rooms[socket.roomCode].host === socket.id) {
        io.to(socket.roomCode).emit('hostDisconnected');
        delete rooms[socket.roomCode];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
