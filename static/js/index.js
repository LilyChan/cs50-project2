// Connect to websocket
var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

document.addEventListener('DOMContentLoaded', () => {

    //if first visit, promt modal asking for a name
    let hasname = localStorage.getItem('displayName');
    if(!hasname){
        document.querySelector("#showModal").click();
    }else 
        document.querySelector('#displayname').innerHTML = hasname;
    document.querySelector('#username').onblur = () => {clearErrorMsg('#alertMsg_username')};
    document.querySelector('#loginwithusername').onsubmit = login;

    // When connected, configure buttons
    socket.on('connect', () => {
        // configure button to emit a "create channel" event
        document.querySelector('#newChannelName').onblur = () => {clearErrorMsg('#alertMsg_channel')};
        document.querySelector('#createNewChannel').onsubmit = (evt) => {
            evt.preventDefault();
            let newname = document.querySelector('#newChannelName').value;
            socket.emit('create_channel', {'name': newname});
        };
        // Press enter to send message
        document.querySelector('#newMessage').onkeydown = (e) => {
            let keyCode = e.keyCode;
            let key = e.key;
            if ( !(e.ctrlKey || e.shiftKey) && keyCode===13){
                e.preventDefault();
                document.querySelector('#submitMessage').click();
            }
        };

        //configure button to emit a 'new message' event
        document.querySelector('#inputMessage').onsubmit = (evt) => {
            evt.preventDefault();
            let msg = document.querySelector('#newMessage').value;
            socket.emit('new_message', {'msg':msg, 'author':localStorage.getItem('displayName'), 'channel': localStorage.getItem('defaultChannel')});
            document.querySelector('#newMessage').value = '';
            $('#newMessage').focus();
        };
    });
    
    // When a new channel is announced, add to the list
    socket.on('announce new channel', data => {
        //close modal
        document.querySelector('#newChannelName').value = '';
        clearErrorMsg('#alertMsg_channel');
        $('#promptInput_channel').modal('hide');
        //create new channel element and bind click event
        const link = document.createElement('a');
        const linkText = document.createTextNode(data.channelName);
        link.setAttribute('class',"list-group-item list-group-item-action js-selectChannel");
        link.setAttribute('data-name',data.channelName);
        link.appendChild(linkText);
        //set onclick event
        selectChannel(link);
        document.querySelector('#channelList').append(link);
    });

    // When Duplicate channel name
    socket.on('duplicate channel', data => {
        const alertEleId = '#alertMsg_channel';
        document.querySelector(alertEleId).innerHTML = data.msg;
        document.querySelector(alertEleId).style.display = 'block';
    });

    // When Receive New Message (include self send message, but only display if user is on the channel)
    socket.on('announce new message', data => {
        console.log('get data',data);
        if(localStorage.getItem('defaultChannel')===data.channelName){
            const template = Handlebars.compile(document.querySelector('#messageBox').innerHTML);
            document.querySelector('#channelContent').innerHTML += template({messages:_processResMsg([data.message])});
            scrollToBottom();
        }
    });

    // When Someone take back it's message
    socket.on('author delete message', data => {
        console.log('author delete message',data);
        if(localStorage.getItem('defaultChannel')===data.channelName){
            const template = Handlebars.compile(document.querySelector('#messageBox').innerHTML);
            $('#'+data.message.messageid).prop('outerHTML', template({messages:_processResMsg([data.message])}));
            //document.querySelector('#'+data.message.messageid).outerHTMLL = template({messages:_processResMsg([data.message])});
        }
    });

    //set default channel
    if(!localStorage.getItem('defaultChannel')) 
        localStorage.setItem('defaultChannel', 'Official');
    load_chatHistory(localStorage.getItem('defaultChannel'));

    //Select Channel
    document.querySelectorAll('.js-selectChannel').forEach( channel => selectChannel(channel));
});

function selectChannel(channel){
    let channelname = channel.dataset.name;
    channel.onclick = () => {
        localStorage.setItem('defaultChannel', channelname);
        $('#channelList').collapse('hide');
        load_chatHistory(channelname); 
    };
}

function clearErrorMsg(id){
    document.querySelector(id).style.display = 'none';
}

function scrollToBottom(){
    document.querySelector('#channelContent').scrollTo({
        top: document.querySelector('#channelContent').scrollHeight, 
        behavior: "smooth" 
    });
}

function login(evt){

    //prevent default form submit
    evt.preventDefault();

    let username = document.querySelector('#username').value;
    const request = new XMLHttpRequest();
    request.open('POST', '/login');

    // Callback function for when request completes
    request.onload = () => {
        const data = JSON.parse(request.responseText);
        if (data.success) {
            localStorage.setItem('displayName', username);
            clearErrorMsg('#alertMsg_username');
            document.querySelector('#displayname').innerHTML = username;
            $('#promptInput').modal('hide');
        }else{
            document.querySelector('#alertMsg_username').innerHTML = data.msg;
            document.querySelector('#alertMsg_username').style.display = 'block';
        }        
    };

    // Add data to send with request
    const data = new FormData();
    data.append('username', username);

    // Send request
    request.send(data);
}

// Renders channel contents in main view.
function load_chatHistory(channelname) {
    console.log('load history of ',channelname);
    const request = new XMLHttpRequest();
    request.open('GET', `/channel/${channelname}`);
    request.onload = () => {
        let response = JSON.parse(request.responseText);
        response =  _processResMsg(response);
        console.log(response);
        // display Template for messages
        const template = Handlebars.compile(document.querySelector('#messageBox').innerHTML);
        document.querySelector('#channelContent').innerHTML = template({messages:response});
        document.querySelector('#currentChannel').innerHTML = channelname;  
        scrollToBottom();
    };
    request.send();
}

//function to add label for messages to display right/left
function _processResMsg(msgArr){
    return msgArr.map( r => {
        return {
            ...r,
            msgalign: r.author===localStorage.getItem('displayName') ? 'bs-popover-left float-right' : 'bs-popover-right',
            msgbgcolor: r.author===localStorage.getItem('displayName')? 'popover--msgauthor':'',
            mymessage: r.author===localStorage.getItem('displayName')
        }
    });
}

//function to take back message by id
function tackBackMsg(id){
    console.log('tackback msg',id);
    socket.emit('delete_message', {'channel': localStorage.getItem('defaultChannel'),'id':id});
}