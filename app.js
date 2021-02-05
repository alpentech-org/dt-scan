require('dotenv').config();
const config = require('./config/config');
const express = require('express');
const request = require('request');
const app = express();
const path = require('path');
const fs = require('fs');
const ws = require('windows-shortcuts');
const port = config.port;

app.use(express.static('public'));

// Route de récupération de l'architecture du dossier à scanner
app.get('/mainfolder', function(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  let items = fs.readdirSync(config.mainFolderPath, {
    withFileTypes: true,
  });
  let folderArchitecture = [];
  items.forEach((item, i) => {
    let name = item.name;
    if (name != "Thumbs.db") { // Fichier automatiquement créé par windows dans chaque dossier
      if (item.isFile()) {
        if (name.substring(name.length - 4, name.length) == ".lnk") {
          folderArchitecture.push({
            type: "link",
            name: name,
            displayOrder: 2,
          });
        } else {
          folderArchitecture.push({
            type: "file",
            name: name,
            displayOrder: 1,
          });
        }
      } else if (item.isDirectory()) {
        folderArchitecture.push({
          type: "folder",
          name: name,
          content: [],
          displayOrder: 3,
        });
        getSubFolderContent(config.mainFolderPath + "\\" + name, folderArchitecture[folderArchitecture.length - 1].content);
      } else {
        folderArchitecture.push({
          type: "error",
          name: name,
          displayOrder: 0,
        });
      }
    }
  });
  res.end(JSON.stringify(folderArchitecture));
});

// Route d'analyse de provenance d'un lien
app.get('/linktest', function(req, res) {
  console.log(req.query.path)
  ws.query(req.query.path, (err, opt) => {
    console.log(JSON.stringify(err))
    fs.access(opt.expanded.target, fs.F_OK, (err) => {
      if (err) {
        let responseObject = {
          target: opt.expanded.target,
          exists: false,
        };
        res.send(JSON.stringify(responseObject));
      } else {
        let responseObject = {
          target: opt.expanded.target,
          exists: true,
        };
        res.send(JSON.stringify(responseObject));
      }
    });
  });
});

// Route de config du filtre des pièces
app.get('/config', function(req, res) {
  res.sendFile(path.join(__dirname + '/config.html'));
});

// Route de lecture du fichier de config
app.get('/configlist', function(req, res) {
  res.send(fs.readFileSync(__dirname + '/public/resources/configList.txt', 'utf-8'));
});

// Route de modif du fichier de config
app.put('/configlist', function(req, res) {
  fs.writeFileSync(__dirname + '/public/resources/configList.txt', req.query.content, 'utf-8');
  res.send('OK');
});

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/report.html'));
});

// send the main path
app.get('/getrootpath', (req, res) => {
  res.send(config.mainFolderPath);
});

//Start the server by listening on a port
app.listen(port, () => {
  console.log("+---------------------------------------+");
  console.log("|                                       |");
  console.log("|  [\x1b[34mSERVER\x1b[37m] Listening on port: " + config.port + "     |");
  console.log("|                                       |");
  console.log("\x1b[37m+---------------------------------------+");
});

// Fonction d'appel récursif pour explorer le contenu de tous les dossiers
function getSubFolderContent(folderPath, container) {

  let items = fs.readdirSync(folderPath, {
    withFileTypes: true,
  });

  items.forEach((item, i) => {
    if (item.name != "Thumbs.db") { // Fichier automatiquement créé par windows dans chaque dossier
      if (item.isFile()) {
        if (item.name.substring(item.name.length - 4, item.name.length) == ".lnk") {
          container.push({
            type: "link",
            name: item.name,
            displayOrder: 2,
          });
        } else {
          container.push({
            type: "file",
            name: item.name,
            displayOrder: 1,
          });
        }
      } else if (item.isDirectory()) {
        container.push({
          type: "folder",
          name: item.name,
          displayOrder: 3,
          content: [],
        });
        getSubFolderContent(folderPath + "\\" + item.name, container[container.length - 1].content);
      } else {
        container.push({
          type: "error",
          name: item.name,
          displayOrder: 0,
        });
      }
    }
  });

}
