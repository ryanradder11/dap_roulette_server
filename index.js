require('dotenv').load();

var socket = require('socket.io');
var express = require('express');
var https = require('https');
var http = require('http');
var fs = require('fs');
var app = express();
const port = 4000;
const production = process.env.PRODUCTION;

var nicknames = [];

var rooms = {
    test1: {
        max_players: 3,
        commenced: false,
        players: [],
        round: 0
    },
    test2: {
        max_players: 4,
        commenced: false,
        players: [],
        round: 0
    }
};

//Create https server
if (production === '1') {
    //Production server
    var options = {
        key: fs.readFileSync('keys/key.key'),
        cert: fs.readFileSync('keys/cert.crt'),
        ca: fs.readFileSync('keys/bundle.crt')
    };
    var server = https.createServer(options, app).listen(port);
    console.log('Started production server');
} else {
    //Dev and test
    var server = http.createServer(app).listen(port);
    console.log('Started dev/test server');
}

//Socket setup
var io = socket(server);

io.on('connection', function (socket) {
    console.log('You are now connected!: ', socket.id);

    //Check if reconnect
    reconnect(socket);

    socket.on('subscribe', function (data) {

        //If room exists
        if (rooms[data.room] !== null) {

            //How many sockets are present
            var socketsInRoom = 0;
            if (io.sockets.adapter.rooms[data.room]) {
                socketsInRoom = Object.keys(io.sockets.adapter.rooms[data.room].sockets).length;
            }
            var max_players = rooms.test1.max_players;
            if (socketsInRoom >= max_players && rooms[data.room].commenced === false) {

                //Max players already reached
            } else {
                //Allowing new players

                //Join room
                socket.join(data.room);
                console.log('User ' + data.nickname + ' joined: ' + data.room);

                //Store socket with nickname
                nicknames.push({
                    'id': socket.id,
                    'nickname': data.nickname
                });

                //Return all connected clients in room
                io.in(data.room).emit('subscribe', getNamesIdsFromRoom(data.room));

                socketsInRoom = Object.keys(io.sockets.adapter.rooms[data.room].sockets).length;
                console.log('Room: ' + data.room + ' ' + socketsInRoom + '/' + max_players + ' joined');
                if (socketsInRoom === max_players && rooms[data.room].commenced === false) {
                    commenceGame(data.room);
                }
            }

        } else {
            console.log('room: ' + data.room + ' not found');
        }
    });

    //Await votes
    socket.on('vote', function (data) {

        //Is user locked in the room?
        console.log('User decided: ' + data);

        var playerRoom = getRoomFromId(socket.id);

        decide(socket.id, playerRoom);

    });

});


function commenceGame(room) {

    console.log('Commencing game');
    rooms[room].commenced = true;

    //Lock all players in room
    lockPlayersInRoom(room);

    //Signal commence message
    signalCommenceMessage(room);

    //Play a round
    setTimeout(function () {
        playRound(room);
    }, 3000);


}

function playRound(room) {

    //Seconds
    var roundTime = 10;
    rooms[room].round++;

    var hiddenNumber = getRandomInt(100);
    var displayedNumber;
    while (true) {
        displayedNumber = getRandomInt(100);
        if (displayedNumber !== hiddenNumber) {
            break;
        }
    }

    var roundData = {
        number: displayedNumber,
        time: roundTime,
        round: rooms[room].round
    };

    console.log('playing round : ' + JSON.stringify(roundData));
    io.in(room).emit('round', roundData);

    var waiting = false;
}

function countDownTick(room, time) {
    io.in(room).emit('countdown', time);
}

//Locks players in room and defaults them to be in the game
function lockPlayersInRoom(room) {

    var socketsInRoom = Object.keys(io.sockets.adapter.rooms[room].sockets);
    for (var i = 0; i < socketsInRoom.length; i++) {
        rooms[room].players.push({
            id: socketsInRoom[i],
            lost: false,
            decided: false,
            higher: null
        })
    }
}

function signalCommenceMessage(room) {

    var commenceMessage = "The game is now starting...";
    io.in(room).emit('commence', commenceMessage);
}

function startRound(room) {

}


function getNamesIdsFromRoom(room) {

    var namesIds = [];
    var socketsInRoom = Object.keys(io.sockets.adapter.rooms[room].sockets);
    for (var i = 0; i < socketsInRoom.length; i++) {
        var socketId = socketsInRoom[i];

        namesIds.push({
            'nickname': getNickname(socketId),
            'id': socketId
        });
    }
    return namesIds;
}

function getNickname(id) {

    for (var i = 0; i < nicknames.length; i++) {
        if (id === nicknames[i]['id']) {
            return nicknames[i]['nickname'];
        }
    }
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}


//Update later
function reconnect(socket) {
    var currentRooms = Object.keys(rooms);
    var roomToReconnect = null;

    for (var i = 0; i < currentRooms.length; i++) {
        var currentRoom = currentRooms[i];

        for (var x = 0; x < rooms[currentRoom].players.length; x++) {

            console.log(rooms[currentRoom].players[x].id);
            if (rooms[currentRoom].players[x].id === socket.id) {
                roomToReconnect = currentRoom;
            }
        }
    }

    //Reconnect user
    if (roomToReconnect) {
        console.log('reconnection user...');
        socket.emit('subscribe', getNamesIdsFromRoom(currentRoom));
        socket.emit('commence', 'Reconnect!');
    }
}

function getRoomFromId(id) {

    var currentRooms = Object.keys(rooms);
    var room = null;

    for (var i = 0; i < currentRooms.length; i++) {
        var currentRoom = currentRooms[i];

        for (var x = 0; x < rooms[currentRoom].players.length; x++) {

            if (rooms[currentRoom].players[x].id === socket.id) {
                room = currentRoom;
            }
        }
    }

    return room;
}

function decide(id , room) {
    for(var i ; i < rooms[room].players.length; i++){

        if(rooms[room].players[i].id === id){
           rooms[room].players[i].decided = true;
        }
    }
}
