const express = require('express');
const mysql = require('mysql')
const valkey = require('@valkey/valkey-glide')
const os = require("os")
const app = express()
const port = 3000;
const cors = require("cors");

const hostname = os.hostname();

const REDIS_HOSTNAME = "<<YOUR_REDIS_ADDR>>";
const REDIS_PORT = "<<YOUR REDIS_PORT>>"
const SQL_HOSTNAME = "<<YOUR_SQL_ADDR>>";
const SQL_USERNAME = "<<YOUR_SQL_USERNAME>>";
const SQL_PASSWORD = "<<YOUR_SQL_PASSWORD>>";
const SQL_DBNAME = "<<YOUR_SQL_DBNAME>>"
const SQL_TABLENAME = "<<YOUR_SQL_TABLENAME>>"

app.use(cors())

let client;
valkey.GlideClusterClient.createClient({
	addresses: [{ host: REDIS_HOSTNAME, port: REDIS_PORT }], useTLS: true
}).then(c => {
	console.log("Connection to redis completes");
	client = c;
});

const connection = mysql.createConnection({
	host: SQL_HOSTNAME,
	user: SQL_USERNAME,
	password: SQL_PASSWORD,
	database: SQL_DBNAME
})

app.get('/', async (req, res) => {
	res.send("Hello world");
})

app.get("/search/:query", async (req, res) => {
	const data = await client.get(req.params.query);
	if (data) {
		res.send({ data: JSON.parse(data), source: "redis", hostname });
		return;
	}

	const sqlQuery = `SELECT * FROM ${SQL_TABLENAME} WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR ip_address LIKE ?`;
	const searchString = "%" + req.params.query + "%";
	connection.query(sqlQuery, [searchString, searchString, searchString, searchString], async (err, rows, fields) => {
		console.log("Connected to sql");
		if (err) throw err

		await client.set(req.params.query, JSON.stringify(rows))
		res.send({ data: rows, source: "sql", hostname });
	})
})

app.get("/search/:query/:clientId", async (req, res) => {
	const cacheString = req.params.clientId + ":" + req.params.query;
	const data = await client.get(cacheString);
	if (data) {
		console.log("cache hit: key, " + cacheString);
		res.send({ data: JSON.parse(data), source: "redis", hostname });
		return;
	}

	const sqlQuery = `SELECT * FROM ${SQL_TABLENAME} WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR Ip_address LIKE ?`;
	const searchString = "%" + req.params.query + "%";
	connection.query(sqlQuery, [searchString, searchString, searchString, searchString], async (err, rows, fields) => {
		if (err) throw err
		console.log("cache miss: key, " + cacheString);

		const indexId = "INDEX:" + req.params.clientId
		const index = await client.get(indexId);
		if (!index) {
			await client.set(indexId, JSON.stringify([req.params.query]));
		} else {
			const indexValue = JSON.parse(index);
			console.log("indexValue: ", indexValue);
			indexValue.push(req.params.query);
			console.log("after indexValue: ", indexValue);
			await client.set(indexId, JSON.stringify(indexValue));
		}

		await client.set(cacheString, JSON.stringify(rows))
		res.send({ data: rows, source: "sql", hostname });
	})
})

app.delete("/cache/flush/:clientID", async (req, res) => {
	const indexId = "INDEX:" + req.params.clientID;

	const ids = JSON.parse(await client.get(indexId));
	console.log('preflush', ids);
	if (ids.length !== 0) {
		const toFlush = ids.map((id) => req.params.clientID + ":" + id).concat(indexId)
		console.log("toFlush", toFlush);
		await client.del(toFlush);
	}
	res.sendStatus(200);
})

app.delete("/cache/flush", async (req, res) => {
	console.log("flush all")
	await client.flushdb(valkey.FlushMode.SYNC);
	res.sendStatus(200);
})

app.listen(port, () => {
	console.log(`App listening on port ${port}`)
})

