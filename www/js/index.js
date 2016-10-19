
//**********************************************
//** begin - Config Parameter
//**********************************************

//SSID prefix to found iot devices 
var nubixSSID="nubix";

//page to go after configured device
var nextPage = "configured.html";

//page to go after configured device
var errorPage = "notconfigured.html";

//**********************************************
//** end - Config Parameter
//**********************************************


//**********************************************
//** begin - framework7 stuff
//**********************************************

var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        //document.addEventListener("batterystatus", onBatteryStatus, false);
        
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
        wifiOnDeviceReady ();
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {  
        console.log('Received Event: ' + id);
    }
};

app.initialize();

// Init App
var myApp = new Framework7({
    modalTitle: 'Nubix',
    // Enable Material theme
    material: true   
});

var mainView = myApp.addView('.view-main', {
});

var $$ = Dom7;

//**********************************************
//** end - framework7 stuff
//**********************************************

myApp.showPreloader('Searching compatible IoT device...');

//global variable to store the device network with the strongest signal
var network;

//how many times it tried to send network info to the device
var sendTries;

//asks for local permission (to list wifi networks)
function localPermission () {
    cordova.plugins.diagnostic.getLocationAuthorizationStatus(function(status){
        console.log (status);
        if(status != "GRANTED"){    
            cordova.plugins.diagnostic.requestLocationAuthorization(function(status){
                    if(status != "GRANTED"){
                        navigator.app.exitApp();
                    }
                }, function(error){
                    console.error(error);
            });
        }
    }, wifiError);
}

//state 0 - check if wifi is ON - if is not, turn it on
function wifiOnDeviceReady  () {
    localPermission ();
    //try to turn on the wifi in the cellphone
    WifiWizard.isWifiEnabled(function (enabled) {
        if (enabled == false) {
            WifiWizard.setWifiEnabled(true, function (){
                searchNubixDevice();
            }, wifiError);
        } else {
            searchNubixDevice();
        }
    }, wifiError);
}

//state 1 - look for iot devices to configure
function searchNubixDevice () {
    try {
         getWifiList ();
    } catch(err) {
        alert (err.message);
    }   
};

//state 1 - get wifi network available list
function getWifiList(){  
    WifiWizard.startScan(function () {        
        WifiWizard.getScanResults (handleWifiList, wifiError)
    }, wifiError);
 }




//state 1 - handle the wifi available networks looking for devices to configure
//if there are any, stores the one with the strongest signal
function handleWifiList(a){ 
    var found = new Array ();
    for (var i =0; i< a.length; i+=1) {
        if (a[i].SSID.indexOf (nubixSSID)==0) {
            found.push (a[i]);
        }
    }
    found = found.sort (function (a,b){ 
            return a.level - b.level;
    } );
    if (found.length>0) {
        //found - routing to the config html
        myApp.hidePreloader();
        network = found[0]; 
        mainView.router.loadPage("config.html");
    }
    else {
        //didnt find - try again - does not have timeout
        setTimeout (searchNubixDevice,5000);
    }
}


//state 2 - try to send network info to the iot device
function trySend () {
    console.log ("trySend");
    sendTries +=1;
     if (sendTries == 1)
        myApp.showPreloader('sending network info...');
     //if it is not connected to the device network, try to connect
     WifiWizard.getCurrentSSID(function (ssid) {
            ssid = ssid.replace ("\"","");
            if (ssid.indexOf(nubixSSID)==0) {
                 //it is connected. send info
                 console.log ("already connected");
                 setTimeout(sendNetworkInfo,5000);
            } else {                 
                //it is not connected - add network and try to connect
                
                //add iot device authorization type - NONE
                network.auth = new Object ();
                network.auth.algorithm = "NONE";                
                WifiWizard.addNetwork (network, function () {
                    WifiWizard.connectNetwork(network.SSID, function (){
                         console.log ("network added");
                         //now is connected. send info
                         setTimeout(sendNetworkInfo,5000);
                    }, wifiError);                
                }, wifiError);
            }
        }, wifiError);
}

//state 2 - send SSID / pass to the device
function  sendNetworkInfo () {
     
    
    var socket = new Socket(); 
    console.log ("sendNetworkInfo");
    socket.open(
        "192.168.4.1",
        9402,
        function() {
            console.log ("socket open");
            myApp.hidePreloader();     
            var dataString = "NI:"+$$("#ssid").val()+","+$$("#pass").val (); 
            console.log (dataString);
            var data = new Uint8Array(dataString.length);
            for (var i = 0; i < data.length; i++) {
              data[i] = dataString.charCodeAt(i);
            }
            socket.write(data,function (){
                socket.close ();   
                myApp.hidePreloader();
                console.log  (sendTries);
                mainView.router.loadPage(nextPage);
            },function (message) {
                console.log (message);
                socket.close ();               
                if (sendTries < 15)
                    trySend ();
                else {
                    myApp.hidePreloader();
                  mainView.router.loadPage(errorPage);  
                }
            });  
        }, function(errorMessage) {
          console.log (errorMessage);
          
          if (sendTries < 15)
            trySend ();
          else {
              myApp.hidePreloader();
              mainView.router.loadPage(errorPage);  
          }
        }
    );
    

  
   
}



//handle page inits
myApp.onPageInit('config', function (page) {
    //try to send network info to the iot device
    $$('#send').on('click', function () { 
        if ($$('#ssid').val () !== "" && $$('#pass').val () !== "") {           
            sendTries = 0;
            trySend ();
        }
        return false;
        
    });
    $$('form.ajax-submit').on('beforeSubmit', function (e) { 
        var xhr = e.detail.xhr; 
        xhr.abort();
    });
    $$('#config-form').on ("submit", function (){return false;})
});

//"""handle""" all errors with the WIFI api
function wifiError (a) {
    alert ("error "+a);
    console.log (a);
}