cordova.define("cz.blocshop.socketsforcordova.Socket", function(require, exports, module) {
/**
 * Copyright (c) 2015, Blocshop s.r.o.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms are permitted
 * provided that the above copyright notice and this paragraph are
 * duplicated in all such forms and that any documentation,
 * advertising materials, and other materials related to such
 * distribution and use acknowledge that the software was developed
 * by the Blocshop s.r.o.. The name of the
 * Blocshop s.r.o. may not be used to endorse or promote products derived
 * from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND WITHOUT ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, WITHOUT LIMITATION, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
 */


var exec = require('cordova/exec');

var SOCKET_EVENT = "SOCKET_EVENT";
var CORDOVA_SERVICE_NAME = "SocketsForCordova";

Socket.State = {};
Socket.State[Socket.State.CLOSED = 0] = "CLOSED";
Socket.State[Socket.State.OPENING = 1] = "OPENING";
Socket.State[Socket.State.OPENED = 2] = "OPENED";
Socket.State[Socket.State.CLOSING = 3] = "CLOSING";

function Socket() {
    this._state = Socket.State.CLOSED;
    this.onData = null;
    this.onClose = null;
    this.onError = null;
    this.socketKey = guid.generate();
}

Socket.prototype.open = function (host, port, success, error) {

    success = success || function() { };
    error = error || function() { };

    if (this._state === Socket.State.OPENING) {
        this.close();
    }
    if (!this._ensureState(Socket.State.CLOSED, error)) {
        return;
    }

    var _that = this;

    function socketEventHandler(event) {

        var payload = event.payload;

        if (payload.socketKey !== _that.socketKey) {
            return;
        }

        switch (payload.type) {
            case "Close":
                _that._state = Socket.State.CLOSED;
                window.document.removeEventListener(SOCKET_EVENT, socketEventHandler);
                _that.onClose(payload.hasError);
                break;
            case "DataReceived":
                _that.onData(new Uint8Array(payload.data));
                break;
            case "Error":
                _that.onError(payload.errorMessage);
                break;
            default:
                console.error("SocketsForCordova: Unknown event type " + payload.type + ", socket key: " + payload.socketKey);
                break;
        }
    }

    _that._state = Socket.State.OPENING;

    exec(
        function () {
            _that._state = Socket.State.OPENED;
            window.document.addEventListener(SOCKET_EVENT, socketEventHandler);
            success();
        },
        function(errorMessage) {
            _that._state = Socket.State.CLOSED;
            error(errorMessage);
        },
        CORDOVA_SERVICE_NAME,
        "open",
        [ this.socketKey, host, port ]);
};

Socket.prototype.write = function (data, success, error) {

    success = success || function() { };
    error = error || function() { };

    if (!this._ensureState(Socket.State.OPENED, error)) {
        return;
    }

    var dataToWrite = data instanceof Uint8Array
        ? Socket._copyToArray(data)
        : data;

    exec(
        success,
        error,
        CORDOVA_SERVICE_NAME,
        "write",
        [ this.socketKey, dataToWrite ]);
};

Socket.prototype.shutdownWrite = function (success, error) {

    success = success || function() { };
    error = error || function() { };

    if (!this._ensureState(Socket.State.OPENED, error)) {
        return;
    }

    exec(
        success,
        error,
        CORDOVA_SERVICE_NAME,
        "shutdownWrite",
        [ this.socketKey ]);
};

Socket.prototype.close = function (success, error) {

    success = success || function() { };
    error = error || function() { };

    if (!this._ensureState(Socket.State.OPENED, error)) {
        return;
    }

    this._state = Socket.State.CLOSING;

    exec(
        success,
        error,
        CORDOVA_SERVICE_NAME,
        "close",
        [ this.socketKey ]);
};

Object.defineProperty(Socket.prototype, "state", {
    get: function () {
        return this._state;
    },
    enumerable: true,
    configurable: true
});

Socket.prototype._ensureState = function(requiredState, errorCallback) {
    var state = this._state;
    if (state != requiredState) {
        window.setTimeout(function() {
            errorCallback("Invalid operation for this socket state: " + Socket.State[state]);
        });
        return false;
    }
    else {
        return true;
    }
};

Socket.dispatchEvent = function (event) {
    var eventReceive = document.createEvent('Events');
    eventReceive.initEvent(SOCKET_EVENT, true, true);
    eventReceive.payload = event;

    document.dispatchEvent(eventReceive);
};

Socket._copyToArray = function (array) {
    var outputArray = new Array(array.length);
    for (var i = 0; i < array.length; i++) {
        outputArray[i] = array[i];
    }
    return outputArray;
};

/**
 * Fast UUID generator, RFC4122 version 4 compliant.
 * @author Jeff Ward (jcward.com).
 * @license MIT license
 * @link http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
 **/
var guid = (function() {
  var self = {};
  var lut = []; for (var i=0; i<256; i++) { lut[i] = (i<16?'0':'')+(i).toString(16); }
  self.generate = function() {
    var d0 = Math.random()*0xffffffff|0;
    var d1 = Math.random()*0xffffffff|0;
    var d2 = Math.random()*0xffffffff|0;
    var d3 = Math.random()*0xffffffff|0;
    return lut[d0&0xff]+lut[d0>>8&0xff]+lut[d0>>16&0xff]+lut[d0>>24&0xff]+'-'+
      lut[d1&0xff]+lut[d1>>8&0xff]+'-'+lut[d1>>16&0x0f|0x40]+lut[d1>>24&0xff]+'-'+
      lut[d2&0x3f|0x80]+lut[d2>>8&0xff]+'-'+lut[d2>>16&0xff]+lut[d2>>24&0xff]+
      lut[d3&0xff]+lut[d3>>8&0xff]+lut[d3>>16&0xff]+lut[d3>>24&0xff];
  };
  return self;
})();

// Register event dispatcher for Windows Phone
if (navigator.userAgent.match(/iemobile/i)) {
    window.document.addEventListener("deviceready", function () {
        exec(
            Socket.dispatchEvent,
            function (errorMessage) {
                console.error("SocketsForCordova: Cannot register WP event dispatcher, Error: " + errorMessage);
            },
            CORDOVA_SERVICE_NAME,
            "registerWPEventDispatcher",
            [ ]);
    });
}

module.exports = Socket;

});
