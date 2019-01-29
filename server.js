let express = require("express");
let app = express();
app.use(express.json());

let redis = require("redis");
let client = redis.createClient();

const {promisify} = require('util');
const getAsync = promisify(client.hget).bind(client);
//Handling db errors
client.on("error", function (err) {
	console.log("Error " + err);
});


///User handling
app.post("/createUser",function(req, res) {
	//Verify if user exists in db
	if(req.body.name === undefined || req.body.name.length == 0){
		res.end("User name not provided");
		return;
	}
	client.hkeys("users", function (err, replies) {
		for(let i=0; i<replies.length;i++){
			if(replies[i] === req.body.name){
				res.end("User already exists");
				return;
			}
		}
		let dev = {deviceList:[]};
		toInsert = JSON.stringify(dev);
		client.hset("users",req.body.name,toInsert);
		res.end("User created");
	});
});

app.get("/deleteUser",function(req,res){
	//Search user
	if(req.query.name === undefined || req.query.name.length == 0){
		res.end("User name not provided");
		return;
	}
	client.hkeys("users", function (err, replies) {
		for(let i=0; i<replies.length;i++){
			if(replies[i] === req.query.name){
				client.hdel("users",replies[i]);
				res.end("User deleted");
				return;
			}
		}
		res.end("User not found");
	});
});
///Device adding and removing
app.post("/addDevice",function(req,res){
	//Verify if device does not already exists in db
	client.hkeys("devices", function (err, replies) {
		let name = false;
		let deviceInDevicesList = false;
		let response = ""
		if(req.query.name != undefined && req.query.name.length != 0){
			name = true;
		}
		if(req.body === undefined){
			res.end("Send device");
			return
		}
		//verify if device is in devices list
		for(let i=0; i<replies.length;i++){
			if(replies[i] === req.body.name){
				deviceInDevicesList = true;
			}
		}
		//Add device in devices list
		if(!deviceInDevicesList){
			let device = JSON.stringify(req.body);
			client.hset("devices",req.body.name,device);
		}
		//Verify if user exists and add device name to user device list
		if(name){
			let found = false;
			client.hkeys("users", function (err, replies) {
				for(let i=0; i<replies.length;i++){
					if(replies[i] === req.query.name){
						//get user device list
						found = true; 
						client.hget("users",req.query.name,function(err,reply){
							let data = JSON.parse(reply);
							//Verify if device is not in user device list
							for(let i=0;i<data.deviceList.length;i++){
								if(data.deviceList[i]===req.body.name){
									res.end("Device already added to user");
									return;
								}
							}
							//add device to user list
							data.deviceList.push(req.body.name);
							let toInsert = JSON.stringify(data)
							client.hset("users",req.query.name,toInsert);
							res.end("Device added to user");
							return;
						});
					}
					if(!found){
						res.end("User not found");
						return;
					}
				}
			});
		}
		else{
			res.end("Send a username");
			return;
		}
	});
});

app.get("/deleteDevice",function(req,res){
	//verify if device exists
	client.hkeys("devices", function (err, replies) {
		let deviceFound = false;
		let userFound = false;

		if(req.query.userName === undefined || req.query.userName.length == 0){
			res.end("User not provided");
			return;
		}
		if(req.query.deviceName === undefined || req.query.deviceName.length == 0){
			res.end("Device name not provided");
			return;
		}

		for(let i=0; i<replies.length;i++){
			if(replies[i] === req.query.deviceName){
				//if it exists verify the user
				deviceFound = true;

				client.hkeys("users", function (err, replies) {
					let deviceFound = false;
					for(let i=0; i<replies.length;i++){
						if(replies[i] === req.query.userName){
							//get the user device list
							userFound = true;

							client.hget("users",replies[i],function(err,reply){
								let data = JSON.parse(reply);
								//Verify if device is not in user device list
								for(let i=0;i<data.deviceList.length;i++){
									if(data.deviceList[i]===req.query.deviceName){
										//delete
										data.deviceList.splice(i,1);
										let toInsert = JSON.stringify(data)
										client.hset("users",req.query.userName,toInsert);
										res.end("Device: "+req.query.deviceName+" deleted from user: "+req.query.userName);
										return;
									}
								}
								res.end("User "+req.query.userName+" didn't had "+req.query.deviceName);
								return;
							});
						}
					}
					if(!userFound){
						res.end("User not found");
						return;
					}
				});
			}
		}
		if(!deviceFound){
			res.end("Device name not found");
			return;
		}
	});
});

///Device handlning
app.get("/lightSwitch",function(req,res){
	client.hkeys("devices", function (err, replies) {
		let found = false;
		if(req.query.name === undefined || req.query.name.length === 0){
			res.end("Send device name");
			return;
		}
		for(let i=0; i<replies.length;i++){
			if(replies[i] === req.query.name){
				found = true;
				client.hget("devices",req.query.name,function(err,reply){
					let data = JSON.parse(reply);
					if(data.Status ==="on"){
						data.Status = "off";
					}
					else if(data.Status ==="off"){
						data.Status = "on";
					}
					let toInsert = JSON.stringify(data)
					client.hset("devices",req.query.name,toInsert);
					res.end("Lights changed on device "+req.query.name);
					return;
				});
				
			}
		}
		if(!found){
			res.end("Device not found");
			return;
		}
	});
});

app.get("/setBrightness",function(req,res){
	client.hkeys("devices", function (err, replies) {
		let found = false;
		if(req.query.brightness === undefined){
			res.end("Send brightness level (0-100)");
			return;
		}
		if(req.query.name === undefined || req.query.name.length === 0){
			res.end("Send device name");
			return;
		}
		for(let i=0; i<replies.length;i++){
			if(replies[i] === req.query.name){
				found = true;
				client.hget("devices",req.query.name,function(err,reply){
					let data = JSON.parse(reply);
					if(data.Brightness != undefined){
						let brightLevel = parseInt(req.query.brightness);
						if(brightLevel<0) brightLevel = 0;
						if(brightLevel>100) brightLevel = 100;
						data.Brightness = brightLevel;
						let toInsert = JSON.stringify(data)
						client.hset("devices",req.query.name,toInsert);
						res.end("Brightness changed on device "+req.query.name);
						return;
					}
					else{
						res.end("Device doesn't have brightness control");
						return;
					}
				});
				
			}
		}
		if(!found){
			res.end("Device not found");
			return;
		}
	});
});


var server = app.listen(8085, function () {
	var host = server.address().address
	var port = server.address().port

	console.log("Example app listening at http://%s:%s", host, port)
})
