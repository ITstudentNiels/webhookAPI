const express = require('express');
const bodyParser = require('body-parser');
const basicAuth = require('express-basic-auth');
const mysql = require('mysql2');
const fs = require('fs');
const fse = require('fs-extra');
//const Ansible = require('node-ansible');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(basicAuth({
	users: {
		'admin': 'dankjewelpeter62',
	}
}));

const connection = mysql.createConnection({
	host: process.env.DATABASE_HOST,
	user: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASS,
	database: process.env.DATABASE_NAME,
	multipleStatements: true,
});	

const port = process.env.PORT;

app.get("/", function(req, res) {
	res.send('Hello World');
});

app.post("/api/grafana", function(req, res) {
	const message = req.body.message;
	console.log(message);
	if (message === 'upscale') {
		connection.query(
			"INSERT INTO `instances` (`id`, `name`, `role`, `main`) SELECT max(id) + 1, CONCAT(?, max(id) + 1), ?, ? FROM `instances`; SELECT max(id) AS id FROM `instances`", [process.env.DOCKER_INSTANCE_PNAME, process.env.DOCKER_INSTANCE_TYPE, process.env.DOCKER_INSTANCE_MAIN] ,
			function(err, results) {
				if (err) throw err;
				const NodeID = results[1][0]['id'];
				const NodeHostname = process.env.DOCKER_INSTANCE_HNAME + NodeID;
				const NodeVMName = process.env.DOCKER_INSTANCE_PNAME + NodeID;

				if (results[0]['affectedRows'] != 0) {

					console.log('Information about the node has been added to the database.');

					exec(`ansible-playbook /etc/ansible/create-dkr-worker.yml -e vm_name=${NodeVMName} -e hostname=${NodeHostname}`, (err, stdout, stderr) => {
						if (err) {
							console.log(`error: ${err.message}`);
							return;
						}
						if (stderr) {
							console.log(`stderr: ${stderr}`);
							return;
						}
						console.log(`stdout: ${stdout}`);
					});

					console.log('An new node has been added to the swarm');
				}
			}
		);
	}
	else if (message === 'downscale') {
		connection.query(
			"SELECT @maxID := max(id) FROM `instances`; DELETE FROM `instances` WHERE `id` = @maxID AND `main` != 1;",
			function(err, results) {
				if (err) throw err;
				const NodeID = Object.values(results[0][0])[0];
				const NodeHostname = process.env.DOCKER_INSTANCE_HNAME + NodeID;
				const NodeVMName = process.env.DOCKER_INSTANCE_PNAME + NodeID;

				if (results[1]['affectedRows'] != 0) {

					console.log('Information about the node has been removed');

					exec(`ansible-playbook /etc/ansible/remove-dkr-worker.yml -e vm_name=${NodeVMName} -e hostname=${NodeHostname}`, (err, stdout, stderr) => {
						if (err) {
							console.log(`error: ${err.message}`);
							return;
						}
						if (stderr) {
							console.log(`stderr: ${stderr}`);
							return;
						}
						console.log(`stdout: ${stdout}`);
					});

					console.log('One node has been removed!');
				}
			}
		);
	}
	else {
		console.log('Error');
	}

	res.send("Hello");
});

app.post("/api/docker", async function(req,res) {
	const student_number = req.body.data.student_number;
	const port = req.body.data.port;
	const instance = req.body.data.instance;
	const database = req.body.data.database;
	const state = req.body.data.state;
        const db_username = req.body.data.database_username;
        const db_password = req.body.data.database_password;

	if (state === 'present') {
		if (database === '') {
			var command = `ansible-playbook /etc/ansible/create-dkr-stack.yml -e student_number=${student_number} -e student_port=${port} -e instance=${instance}`;
			exec (command, (err, stdout, stderr) => {
				if (err) {
					console.log(`error: ${err.message}`);
				}
				if (stderr) {
					console.log(`stderr: ${stderr}`);
				}
				console.log(`stdout: ${stdout}`);
			});
		} 
		else {
			await fs.readdir('/mnt/Student-data/root/files/460499/', function (err, files) {
				const selectedFile = files.filter(file => file.includes('.db'));
				const databaseName = selectedFile[0].slice(0, -3);
				var command = `ansible-playbook /etc/ansible/create-dkr-stack.yml -e student_number=${student_number} -e student_port=${port} -e instance=${instance} -e database=${database} -e db_username=${db_username} -e db_password=${db_password} -e db_name=${databaseName}`;
				exec(command, (err, stdout, stderr) => {
					if (err) {
						console.log(`error: ${err.message}`);
					}
					if (stderr) {
						console.log(`stderr: ${stderr}`);
					}
					console.log(`stdout: ${stdout}`);
				})
			});
		}

//		await exec(command, (err, stdout, stderr) => {
//			if (err) {
//				console.log(`error: ${err.message}`);
//			}
//			if (stderr) {
//				console.log(`stderr: ${stderr}`);
//			}
//			console.log(`stdout: ${stdout}`);
//		});
	}
	if (state === 'absent') {
		exec(`ansible-playbook /etc/ansible/remove-dkr-stack.yml -e student_number=${student_number}`, (err, stdout, stderr) => {
			if (err) {
				console.log(`error: ${err.message}`);
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`);
			}
			console.log(`stdout: ${stdout}`);
		});
	}
	res.send("Hello");
});

app.post("/api/nginx", function(req, res) {
	const student_number = req.body.data.student_number;
	const student_port = req.body.data.port;
	const student_domain = req.body.data.domain;
	const state = req.body.data.state;
	const sdLocation = '/mnt/Docker-data/student_data/' + student_number
	console.log(student_number);
	if (state === 'present') {
//		exec('ansible-playbook /etc/ansible/create-nginx-config.yml -e student_number=1234 -e student_domain=1234 -e student_port=1234', (err, stdout, stderr) => {
                exec(`ansible-playbook /etc/ansible/create-nginx-config.yml -e student_number=${student_number} -e student_domain=${student_domain} -e student_port=${student_port} && sudo mkdir ${sdLocation} && sudo mkdir ${sdLocation}/data && sudo mkdir ${sdLocation}/mysql && sudo mkdir ${sdLocation}/mariadb && sudo mkdir ${sdLocation}/wordpress && sudo mkdir ${sdLocation}/wordpress/data && sudo mkdir ${sdLocation}/wordpress/database`, (err, stderr, stdout) => {
			if (err) {
				console.log(`error: ${err.message}`);
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`);
			}
			console.log(`stdout ${stdout}`);
		});
	};
	if (state === 'absent') {
		exec(`ansible-playbook /etc/ansible/remove-nginx-config.yml -e student_number=${student_number} && sudo rm -rf ${sdLocation}`, (err, stderr, stdout) => {
			if (err) {
				console.log(`error: ${err.message}`);
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`);
			}
			console.log(`stdout ${stdout}`);
		});
	};
	res.send("Hello");
});

app.post("/api/files", function (req, res) {
	const studentNumber = req.body.data.student_number;
	const type = req.body.data.type;

	if (type === 'github') {
		const url = req.body.data.url;
		var filesLocation = '/mnt/Student-data/root/files/' + studentNumber + "/";
		var allFilesLocation = filesLocation + "{*,.*}";

		exec(`sudo rm -rf ${filesLocation} && sudo rm -rf ${allFilesLocation}  && sudo git clone ${url} ${filesLocation}; sudo chown -R www-data:www-data /mnt/Student-data/`, (err, stderr, stdout) => {
			if (err) {
				console.log(`error: ${err.message}`);
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`);
			}
			console.log(`stdout: ${stdout}`);
		});
	}
	if (type === 'nextcloud') {
		var filesLocation = '/mnt/Student-data/root/files/' + studentNumber + "/";
		var allFilesLocation = filesLocation + "{*,.*}";
		
		console.log(allFilesLocation);
		exec(`sudo rm -rf ${filesLocation} && sudo rm -rf ${allFilesLocation} && sudo mkdir ${filesLocation} && sudo chown -R www-data:www-data /mnt/Student-data/`, (err, stderr, stdout) => {
			if (err) {
				console.log(`error: ${err.message}`);
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`);
			}
			console.log(`stdout: ${stdout}`);
		});
	}
	res.send("Hello");
});

app.post("/api/dataLength", function (req, res) {
	const studentNumber = req.body.data.student_number;
	const dir = '/mnt/Student-data/root/files/' + studentNumber;

	fs.readdir(dir, (err, files) => {
		res.send({ 'size': files.length -1 });
	});

});

app.post("/api/copyFiles", function (req, res) {
	const studentNumber = req.body.data.student_number;

	const srcLocation = '/mnt/Student-data/root/files/' + studentNumber + '/';
	const dstLocation = '/mnt/Docker-data/student_data/' + studentNumber + '/data/';

	exec(`sudo rm -rf ${dstLocation}* && sudo rm -rf ${dstLocation}../mysql/* && sudo cp -r ${srcLocation}. ${dstLocation}`, (err, stderr, stdout) => {
		if (err) {
			console.log(`error: ${err.message}`);
		}
		if (stderr) {
			console.log(`stderr: ${stderr}`);
		}

		console.log(`stdout: ${stdout}`);
//		fse.moveSync(srcLocation, dstLocation, (err) => {
//			if (err) {
//				console.log(`error: ${err.message}`);
//			}
//		})
	})
});

app.post("/api/wordpressData", function (req, res) {
	const studentNumber = req.body.data.student_number;

	const location = '/mnt/Docker-data/student_data/' + studentNumber + '/wordpress/';

	exec(`sudo rm -rf ${location}data/* && sudo rm -rf ${location}database/*`, (err, stderr, stdout) => {
		if (err) {
			console.log(`error: ${err.message}`);
		}
		if (stderr) {
			console.log(`stderr: ${stderr}`);
		}
		console.log(`stdout: ${stdout}`);
	});
	res.send("Hello");
});

app.listen(port, function() {
	console.log(`Server running on port ${port}`);
});
