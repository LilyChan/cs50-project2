import os
import time
import uuid 
from flask import Flask, jsonify, render_template, redirect, url_for, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)

channels = {'Official':[{'messageid':'12345','msg':'Welcome to the default channel', 'author':'admin', 'time': time.ctime()},
                        {'messageid':'67890','msg':'Feel free to create your own channel!', 'author':'admin', 'time': time.ctime()}]}
users = []

@app.route("/")
def index():
    return render_template("index.html", channels=channels.keys())

@app.route("/login", methods=['POST'])
def login():
    if request.method == 'POST':
        name = request.form.get('username')
        print(name, users)
        if name not in users:
            users.append(name)
            print(users)
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, 'msg': 'Username already exists, please type another one!'})

@app.route("/channel/<string:name>", methods=['GET'])
def getChannelContent(name):
    print('get channel itm:',name)
    return jsonify(channels[name])

@socketio.on("new_message")
def appendNewMessageToChannel(data):
    print('channel content',data)
    if(len(channels[data['channel']]) == 100):
        channels[data['channel']].pop(0)
    message = {'msg':data['msg'], 'author': data['author'], 'time': time.ctime(), 'messageid':uuid.uuid1().hex}
    channels[data['channel']].append(message)    
    emit("announce new message", {"channelName": data['channel'], 'message':message}, broadcast=True)

@socketio.on("delete_message")
def deleteMessageFromChannel(data):
    channelMsg = channels[data['channel']]
    for i in range(len(channelMsg)):
        if channelMsg[i]['messageid'] == data['id']:
            channelMsg[i]['deleted'] = True
            emit("author delete message", {"channelName": data['channel'], 'message':channelMsg[i]}, broadcast=True)
            break

@socketio.on("create_channel")
def createNewChannel(data):
    print('in create channel evt',data['name'])
    if data['name'] in channels:
        emit("duplicate channel", {"msg": 'Channel already exists, please type another name!'}, broadcast=False)
    else:
        channels[data['name']] = []
        print(channels)
        emit("announce new channel", {"channelName": data['name']}, broadcast=True)