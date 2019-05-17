var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    mongoose = require('mongoose',)
    users={};

server.listen(3000);

mongoose.connect('mongodb://localhost/chat',{useNewUrlParser:true}, function(err){
    if(err){
        console.log(err);
    }else{
        console.log('sucessful connection')
    }
});

var chatSchema = mongoose.Schema({
    nick: String,
    msg: String,
    created: {type: Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function(req,res){
    res.sendFile(__dirname + '/index.html')
})

/** on first login the last 8 messages are loaded **/
io.sockets.on('connection', function(socket){
    var query = Chat.find({});
    query.sort('-created').limit(8).exec(function(err, docs){
        if(err) throw err;
        socket.emit('load old msgs', docs);
    });
    
    /** Socket connection to validate only 1 unique name from list **/
    socket.on('new user', function(data, callback){
        if(data in users){
            callback(false);
        }else{
            callback(true);
            socket.nickname = data;
            users[socket.nickname] = socket;
            updateNicknames();
        }
    });

    /** Socket connection to update users list **/
    function updateNicknames(){
        io.sockets.emit('usernames', Object.keys(users));
    }
    
    /** Socket connection for send message **/
    socket.on('send message', function(data, callback){
        var msg =data.trim();
        /** looks for '/w ' at the begining of the data string for a direct message aka whisper **/
        if(msg.substr(0,3) === '/w '){
            msg=msg.substr(3);
            var ind = msg.indexOf(' ');
            if(ind !== -1){
                /** Trims the data string to include only the receipient user name **/
                var name = msg.substr(0,ind);
                /** Trims the data string to include only the message **/
                var msg = msg.substr(ind+1);
                if(name in users){
                    /** Sends the whisper directly **/
                    users[name].emit('whisper', {msg: msg, nick:socket.nickname});
                }else{
                    /** Error message when the user is no valid or loged in **/
                    callback('Error: Enter a valid user.')
                }
            }else{
                /** Error message when there is no message for the whisper **/
                callback('Error: Please enter a message for your whisper.')
            }
        } else{
            var newMsg = new Chat( {msg: msg, nick:socket.nickname});
            /** this saves the new message to the DB **/
            newMsg.save(function(err){
                if(err) throw err;
                /** Sends the message to general chat **/
                io.sockets.emit('new message', {msg: msg, nick:socket.nickname});
            })
        }
    });
    //** This removes the user form the list when they close the browser **/
    socket.on('disconnect', function(data){
        if(!socket.nickname) return;
        delete users[socket.nickname]
        updateNicknames();
    });
});
