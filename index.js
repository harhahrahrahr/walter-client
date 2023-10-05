const { Client } = require("discord.js-selfbot-v13")
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const axios = require("axios")
require('dotenv').config()

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

let trackName, artistName, trackProgress, trackDuration, songImage, isPlaying;

const port = process.env.PORT

app.get("/", (req, res) => {
	res.sendFile(__dirname + '/normal.html');
})

app.get('/spotify', (req, res) => {
	const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=user-read-playback-state`;
	res.redirect(authUrl);
})

app.get('/callback', (req, res) => {
	const code = req.query.code;
	axios({
		method: 'post',
		url: 'https://accounts.spotify.com/api/token',
		params: {
			code,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code',
		},
		auth: {
			username: clientId,
			password: clientSecret,
		},
	}).then(response => {
		io.emit("spotify-authenticated")
		const accessToken = response.data.access_token;
		const header = {
			'Authorization': `Bearer ${accessToken}`,
		};
		setInterval(() => {
			axios({
				method: 'get',
				url: 'https://api.spotify.com/v1/me/player/currently-playing',
				headers: header,
			}).then(response => {
				if (response.status === 200) {
					trackName = response.data.item.name;
					artistName = response.data.item.artists.map(artist => artist.name).join(', ');
					trackProgress = response.data.progress_ms;
					trackDuration = response.data.item.duration_ms;
					songImage = response.data.item.album.images[2].url;
					isPlaying = response.data.is_playing;
					if (isPlaying) {
						io.emit("spotify update status", [trackName, artistName, trackProgress, trackDuration, songImage]);
					} else {
						io.emit("spotify no tracks playing");
					}
				}
			}).catch(error => {
				console.error(error.status);
				io.emit("spotify integration error")
			});
		}, 950);
		res.sendFile(__dirname + '/index.html');
	}).catch(error => {
		console.error(error.response ? error.response.data : error.message);
		res.status(500).send(`<title>Walter Client - Renavigation</title>Please click <a href="http://localhost:${port}">here</a> to access Walter client.`);
	});
});


const client = new Client({
	checkUpdate: false
})

server.listen(port, () => {
	console.log(`server running: localhost:${port}`)
});

let activeGuild;
let notfriends = [];
let members = [];

client.on("ready", async () => {
	console.log('client ready');
	const guilds = client.guilds.cache;
	guilds.forEach(async (guild) => {
		const channel = guild.channels.cache;
		channel.forEach(channel => {
			notfriends.push(channel.id)
		})
	})
});

client.on("messageCreate", async (message) => {
	const isdms = notfriends.includes(message.channel.id) ? false : true;
	if (activeChannel) {
		if (message.channel === activeChannel) {
			let emitted = false;
			const splitmsg = message.content.split(" ");
			for (const member of members) {
				for (let i = 0; i < splitmsg.length; i++) {
					if (splitmsg[i].includes(`<@${member[0]}>`)) {
						splitmsg[i] = `@${member[1]}`;
						console.log(splitmsg[i]);
						emitted = true;
					}
				}
			}
			
			if (!emitted) {
				io.emit("append to messages", [message.author.globalName, message.content, message.author.username, message.author.id, message.id, message.author.bio]);
			} else {
				io.emit("append to messages", [message.author.globalName, splitmsg.join(" "), message.author.username, message.author.id, message.id, message.author.bio]);
			}
		}
	}
});



client.on('messageUpdate', (oldmessage, newmessage) => {
	if (oldmessage.channel === activeChannel) {
		io.emit("edit message", [newmessage.id.toString(), newmessage.content]);
	}
})
client.on('messageDelete', (message) => {
	io.emit("delete message", message.id.toString())
})

let msgs = []
let activeChannel;
let emojis = []
let emojiSize = 48;
let automodBypass = false;

function clearMessageCache() {
	msgs = []
}
function clearEmojiCache() {
	emojis = []
}
function clearMemberCache() {
	members = []
}

io.on("connection", (socket) => {
	socket.emit("tenor api key", process.env.TENOR_API_KEY)
	socket.on("get spotify status", () => {
		if (trackName && artistName && trackProgress && trackDuration && songImage && isPlaying) {
	      io.emit("spotify update status", [trackName,artistName, trackProgress, trackDuration, songImage]);	
		}
	})
	socket.on("get emojis", () => {
		clearEmojiCache();
		const guildsArray = Array.from(client.guilds.cache.values());

		guildsArray.forEach((guild) => {
			guild.emojis.cache.forEach(async (emoji) => {
				emojis.push([emoji.name, emoji.id, emoji.animated, emoji.guild.id]);
				socket.emit("new emoji", [emoji.animated === false ? `https://cdn.discordapp.com/emojis/${emoji.id}.png` : `https://cdn.discordapp.com/emojis/${emoji.id}.gif`, emoji.name]);
			});
		});
	});
	socket.on("get guilds", () => {
		const guilds = client.guilds.cache;
		guilds.forEach(guild => {
			socket.emit("new guild", [guild.id, guild.icon, guild.name, client.user.id])
		})
	})
	socket.on("fetch messages", (guildId) => {
	const guild = client.guilds.cache.find((g) => g.id === guildId);
	const mem = guild.members.cache;
	clearMemberCache()
	mem.forEach(memb => {
		members.push([memb.user.id, memb.user.username])
	})
	activeGuild = guild;
	if (guild) {
		const channel = guild.channels.cache.find((c) => c.name.includes("general" || "chat"));
		activeChannel = channel;
		if (channel && channel.isText()) {
			msgs = [];

			channel.messages.fetch({ limit: 100 })
				.then((messages) => {
					messages.forEach(message => {
						msgs.push(message);
					});
					msgs.reverse().forEach(message => {
						let emitted = false;
						const splitmsg = message.content.split(" ");
						for (const member of members) {
							for (let i = 0; i < splitmsg.length; i++) {
								if (splitmsg[i].includes(`<@${member[0]}>`)) {
									splitmsg[i] = `@${member[1]}`;
									emitted = true;
								}
							}
						}
						
						if (!emitted) {
							io.emit("append to messages", [message.author.globalName, message.content, message.author.username, message.author.id, message.id, message.author.bio]);
						} else {
							io.emit("append to messages", [message.author.globalName, splitmsg.join(" "), message.author.username, message.author.id, message.id, message.author.bio]);
						}
					});
				})
				.catch((error) => {
					console.error("error during message fetch:", error);
				});
		} else {
			console.error("general channel not found");
		}
	} else {
		console.error("guild not found");
	}
});

	socket.on("send message as user", (e) => {
		const guild = client.guilds.cache.find((g) => g.id === e[1]);
		const channel = guild.channels.cache.find((c) => c.name.includes("general"));
		if (channel && guild) {
			const splitmsg = e[0].split(" ")
			splitmsg.forEach(word => {
				emojis.forEach(emoji => {
					if (word.includes(`:${emoji[0]}:`)) {
						if (emoji[2] === false) {
							if (client.guilds.cache.find((g) => g.id === emoji[3]) === activeGuild) {
								splitmsg[splitmsg.indexOf(`:${emoji[0]}:`)] = `<:${emoji[0]}:${emoji[1]}>`;
							} else {
								splitmsg[splitmsg.indexOf(`:${emoji[0]}:`)] = `https://cdn.discordapp.com/emojis/${emoji[1]}.webp?size=${emojiSize}`
							}
						} else {
							splitmsg[splitmsg.indexOf(`:${emoji[0]}:`)] =`https://cdn.discordapp.com/emojis/${emoji[1]}.gif?size=${emojiSize}`;
						}
					}
				})
			})
			channel.send(splitmsg.join(" "));
			socket.emit("clear input");
		}
	})
	socket.on("set rpc", (e) => {
		if (e[0]) {
			if (e[0] === "play") {
				client.user.setActivity({
					name: `${e[1]}`,
					type: "PLAYING"
				})
			} else if (e[0] === "listen") {
				client.user.setActivity({
					name: `${e[1]}`,
					type: "LISTENING"
				})
			} else if (e[0] === "stream") {
				client.user.setActivity({
					name: `${e[1]}`,
					type: "STREAMING"
				})
			} else if (e[0] === "watch") {
				client.user.setActivity({
					name: `${e[1]}`,
					type: "WATCHING"
				})
			} else if (e[0] === "compete") {
				client.user.setActivity({
					name: `${e[1]}`,
					type: "COMPETING"
				})
			} else {
				client.user.setActivity(null)
			}
		}
	})
	socket.on("emoji size change", (e) => {
		emojiSize = e;
	})
	socket.on("set automod bypass", (e) => {
		automodBypass = e;
	})
})

client.login(process.env.DISCORD_TOKEN)
