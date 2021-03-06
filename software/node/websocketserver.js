//    Software for Irrigation Control Project
//    Copyright (C) 2017  Gregory Raven
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

/*jshint esversion: 6 */
//  This is the WebSockets server for the Irrigation controller.

//  Get the WebSocket class from the Node.js ws package:
const WebSocketServer = require('ws').Server;
//  pumpActuator and Scheduler are Objects from the custom classes.
let pumpActuator = require('./pumpActuator');
let Scheduler = require('./scheduler');

let pumpObject = new pumpActuator();
pumpObject.setMaxListeners(1);
let scheduler = new Scheduler();
scheduler.setMaxListeners(1);

exports.listen = function (server) {
    console.log(`Creating new WebSocketServer`);
    const wss = new WebSocketServer({
        server: server
    });

    console.info('WebSocket server started...');
    wss.on('connection', (ws) => {
        //  The following prevents multiple listeners from being attached.
        scheduler.removeAllListeners('scheduleControl');
        scheduler.removeAllListeners('schedule');
        scheduler.removeAllListeners('timeDisplayUpdate');
        pumpObject.removeAllListeners('pumpStatusMessage');
        //  Start the time updater function:
        let timeDisplay = scheduler.timeDisplayUpdate();

        let url = ws.upgradeReq.url;
        console.info(url);
        console.log(`The WebSocket is connected and request is from ${url}.`);
        console.log(`The number of clients is ${wss.clients.size}`);
        //  Receive/transmit messages to and from the web page and process.
        ws.on('message', (data, flags) => {
            console.log(`Received data from client: ${data}.`);
            let dataObject = JSON.parse(data);
            //  Determine the type of incoming data and dispatch to
            //  either the actuator or scheduling object.
            //  Modify the pumpMapProxy.  This will actuate the LEDs!
            //  Object.assign updates the ledHash in the ledActuator.
            if (dataObject.messageType === "pumpControl") {
                Object.assign(pumpObject.pumpMapProxy, dataObject.control);
            } else if (dataObject.messageType === "schedule") {
                console.log("Schedule message received");
                scheduler.scheduleInterpreter(dataObject);
            }
        });

        //  Handle automatic irrigation from scheduler.
        //  A control array example: ['zone1', 1].  This means turn on zone1 solenoid and pump.
        scheduler.on('scheduleControl', (controlArray) => {
            pumpObject.pumpMapProxy[controlArray[0]] = controlArray[1]; // Set zone to 0 or 1.
            pumpObject.pumpMapProxy.pumpmotor = controlArray[1]; // Set pump to 0 or 1.
        });

        //  Update the "Current Schedule" area of the web page.
        scheduler.on('schedule', (message) => {
            console.log(`Status message received by websocketserver and is: ${message}`);
            //  Send status message if the WebSocket is ready.  Terminate defective WebSockets.
            if (ws.readyState === 1) {
                ws.send(message, (error) => {
                    console.log("WebSocket is ready and sending schedule to Web Page.");
                    if (error) {
                        console.log(`Websocket error on send ${error}`);
                    }
                });
            } else {
                console.log("Killing a defective websocket.");
                ws.terminate();
            }
        });

        //  Update the "Current Time" area of the web page.
        scheduler.on('timeDisplayUpdate', (message) => {
            //    console.log(`Time update message received by websocketserver and is: ${message}`);
            //  Send status message if the WebSocket is ready.  Terminate defective WebSockets.
            if (ws.readyState === 1) {
                ws.send(message, (error) => {
                    console.log(`WebSocket is ready and sending time update to Web Page.`);
                    if (error) {
                        console.log(`Websocket error on send ${error}`);
                    }
                });
            } else {
                console.log("Clearing timeDisplayUpdate interval.");
                clearInterval(timeDisplay);
                ws.terminate();
            }
        });

        //  Send messages to the web page indicating control status.
        pumpObject.on('pumpStatusMessage', (message) => {
            console.log(`Status message received by websocketserver and is: ${message}`);
            //  Send status message if the WebSocket is ready.  Terminate defective WebSockets.
            if (ws.readyState === 1) {
                ws.send(message, (error) => {
                    console.log(`WebSocket is ready and sending time update to Web Page.`);
                    if (error) {
                        console.log(`Websocket error on send ${error}`);
                    }
                });
            } else {
                console.log("Clearing timeDisplayUpdate interval.");
                clearInterval(timeDisplay);
                ws.terminate();
            }
        });

        //  Clear the time update setInterval timer when the WebSocket closes.
        ws.on('close', () => {
            clearInterval(timeDisplay);
            console.log(`WebSocket is closed.`);
        });
    });

    //  Close the server if the 'close' event is sent.
    wss.on('close', function () {
        wss.close(() => {
            console.log("Closing WebSocketServer.");
        });
    });

};
