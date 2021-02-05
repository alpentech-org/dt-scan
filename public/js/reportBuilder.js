// CONVENTIONS DE NOMMAGE
let refFolderRegex = /^[0-9]{8}-[0-9]{6}$/;
let clientFolderName = "DOSSIER CLIENT";
let opFolderRegex = /^OP[0-9]{2} [0-9A-Z\ ]+$/;
let clientDrawingSuffix = " PLAN CLIENT.pdf";
let controlDrawingSuffix = " PLAN CONTROLE.pdf";
let technicalDataFolderName = "DT";
let instructionsFolderName = "INSTRUCTIONS";
let instructionFoldersList = ["PRODUCTION", "QUALITE", "MAINTENANCE", "TRAVAUX NEUFS", "COMMERCE", "ORDONNANCEMENT", "INFORMATION GENERALE"];
let instructionFoldersMapping = {
  "PRODUCTION": {
    path: null,
    prefix: null,
  },
  "QUALITE": {
    path: null,
    prefix: null,
  },
  "MAINTENANCE": {
    path: null,
    prefix: null,
  },
  "TRAVAUX NEUFS": {
    path: null,
    prefix: null,
  },
  "COMMERCE": {
    path: null,
    prefix: null,
  },
  "ORDONNANCEMENT": {
    path: null,
    prefix: null,
  },
  "INFORMATION GENERALE": {
    path: null,
    prefix: null,
  },
}

let table = null; // Initialisation de la dataTable

$(function() {
  // On récupère la liste des dossiers à analyser
  let configContentRequest = {
    "url": "/configlist",
    "method": "GET",
    "timeout": 0,
  };

  $.ajax(configContentRequest).done(function(configContent) {

    //Liste des dossiers à checker
    let filterList = JSON.parse(configContent);
    $('#scanned-ref-nb').html(filterList.length);
    $('#scanned-ref').html(configContent);

    // Requête pour récupérer le contenu brut du dossier à analyser
    let mainFolderRequest = {
      "url": "/mainfolder",
      "method": "GET",
      "timeout": 0,
    };

    $.ajax(mainFolderRequest).done(function(mainFolderContent) { // On récupère le contenu du dossier dans @mainFolderContent
      let mainCont = JSON.parse(mainFolderContent); // On le parse pour avoir un JSON

      let skippedList = ""; // Initialisation de la liste des références non analysées
      let skippedListCnt = ""; // Initialisation de la taille de la liste des références non analysées
      let i = 0;
      while (i < mainCont.length) { // Suppression de la liste des éléments non scannés
        if (mainCont[i].type === "folder" && !filterList.includes(Number(mainCont[i].name.substring(0, 8)))) { // Si la référence n'est pas dans la liste de celles concernées
          skippedList += (skippedList.length ? ";" : "") + mainCont[i].name; // on stocke son nom dans la liste des éléments non analysés
          skippedListCnt++;
          mainCont.splice(i, 1); // on l'enlève
        } else {
          i++;
        }
      }

      $('#unscanned-ref-nb').html(skippedListCnt);
      $('#unscanned-ref').html(skippedList);

      let mainPathRequest = {
        url: '/getrootpath',
        method: "GET",
        timeout: 0,
      }
      $.ajax(mainPathRequest).done(function(rootPath) {
        createFolderTreeHtml(mainCont, $('body'), "Dossier Racine", 0, rootPath); // On appelle la foncion de création de l'arbre, par défaut le dossier racine est appelé "Dossier Racine"
        table = $('#error-log-table').DataTable({
          pageLength: 5,
          lengthChange: false,
        }); // Dessin initial de la table des erreurs

        renderStyle();
      });

    });
  });
});

/*
  FONCTION D'ANALYSE DU ROLE DES ELEMENTS ET DE LEUR CONFORMITE
  Par défaut, un item est conforme si on lui trouve un rôle (en fonction de son nom, sa profondeur dans l'arbre, ses parents, ...) et qu'il matche tous les prérequis de son rôle (enfants obligatoires, formalisme de nom, ...)
  @jsonFolderTree contient le contenu d'un dossier de l'arborescence
  @depth correspond à la profondeur du dossier contenant
  @relativeParentPath est le chemin du dossier contenant
  @absoluteParentPath est le chemin absolu du dossier contenant
*/
function analyseFolderTree(jsonFolderTree, depth, relativeParentPath, absoluteParentPath) {

  jsonFolderTree.forEach((item) => { // On boucle sur tous les items du niveau

    item.path = relativeParentPath + "\\" + item.name; // Ajout du path dans les attribut de l'objet
    item.absolutePath = absoluteParentPath + "\\" + item.name; // Ajout du path absolu dans les attribut de l'objet
    item.conf = true; // Par défaut l'item est OK
    item.err = ""; // On initialise un rapport d'erreur vide

    if (item.type === "file") { // Si l'item est un fichier
      item.fileType = item.name.substring(item.name.lastIndexOf(".") + 1, item.name.length); // On récupère son extension/type
    }
    if (item.type === "link") { // Si l'item est un raccourci
      item.fileType = item.name.substring(item.name.substring(0, item.name.length - 4).lastIndexOf(".") + 1, item.name.substring(0, item.name.length - 4).length); // On récupère l'extension/type du fichier vers lequel il pointe
    }

    switch (depth) { // DEBUT DE L'ANALYSE DES ROLES, PAR PROFONDEUR DANS L'ARBRE

      case 0: // NIVEAU 0 - DOSSIER DES REFERENCES PIECES
        if (item.type === "folder" && item.name.match(refFolderRegex)) { // Si c'est un dossier qui matche le nom des dossiers pièces : REFERENCE[8]-INDICE[6]
          item.role = "refFolder"; // Affectation du role
          let clientFolderPresence = false; // Début du check de la présence des enfants obligatoires : DOSSIER CLIENT
          item.content.forEach((subItem) => {
            if (subItem.type === "folder" && subItem.name === clientFolderName) { // Si au moins un des enfants est un dossier client
              clientFolderPresence = true; // Présence OK
            }
          });
          if (!clientFolderPresence) { // Si pas de dossier client présent
            markFalse(item, "Dossier Client non présent."); // On remonte l'erreur
          }
        } else if (item.type === "folder") { // Si c'est un dossier (à ce stade il ne matche pas le pattern des dossiers de reference-indice)
          markFalse(item, "Mauvais nom de dossier."); // On remonte l'erreur
        } else { // Si ce n'est pas un dossier
          markFalse(item, "Type d'objet interdit à ce niveau."); // On remonte l'erreur
        }
        break;

      case 1: // NIVEAU 1 - DOSSIER CLIENT ou DOSSIER D'OP
        if (item.type === "folder" && item.name === clientFolderName) { // Si c'est un dossier client
          item.role = "clientFolder"; // Affectation du role
          let clientDrawingPresence = false; // Début du check de la présence des enfants obligatoires : PLAN CLIENT
          let controlDrawingPresence = false; // Début du check de la présence des enfants obligatoires : PLAN CONTROLE
          let refNumber = item.path.substring(getCharPositionInString(item.path, '\\', 1), getCharPositionInString(item.path, '\\', 1) + 8); // Récupération de la référence pièce
          item.content.forEach((subItem) => {
            if (subItem.type === "file" && subItem.name === refNumber + clientDrawingSuffix) { // Si on trouve un plan client AU BON NOM
              clientDrawingPresence = true; // Présence OK
            }
            if (subItem.type === "file" && subItem.name === refNumber + controlDrawingSuffix) { // Si on trouve un plan controle AU BON NOM
              controlDrawingPresence = true; // Présence OK
            }
          });
          if (!clientDrawingPresence) { // Si pas de plan client présent
            markFalse(item, "Plan Client non présent."); // On remonte l'erreur
          }
          if (!controlDrawingPresence) { // Si pas de plan controle présent
            markFalse(item, "Plan Contrôle non présent."); // On remonte l'erreur
          }
        } else if (item.type === "folder" && item.name.match(opFolderRegex)) { // Si c'est un dossier qui matche le pattern des dossiers d'OP : OPXX NOM DE L'OP
          item.role = "opFolder"; // Affectation du role
          let dtFolderPresence = false; // Début du check de la présence des enfants obligatoires : dossier "DT"
          let instructionFolderPresence = false; // Début du check de la présence des enfants obligatoires : dossier "INSTRUCTIONS"
          item.content.forEach((subItem) => {
            if (subItem.type === "folder" && subItem.name === technicalDataFolderName) { // Si on trouve le dossier DT
              dtFolderPresence = true; // Présence OK
            }
            if (subItem.type === "folder" && subItem.name === instructionsFolderName) { // Si on trouve le dossier INSTRUCTIONS
              instructionFolderPresence = true; // Présence OK
            }
          });
          if (!dtFolderPresence) { // Si pas de dossier DT présent
            markFalse(item, ' Dossier "DT" non présent.'); // On remonte l'erreur
          }
          if (!instructionFolderPresence) { // Si pas de dossier INSTRUCTIONS présent
            markFalse(item, ' Dossier "INSTRUCTIONS" non présent.'); // On remonte l'erreur
          }
        } else if (item.type === "folder") { // Si c'est un autre dossier mais pas au bon nom
          markFalse(item, ' Mauvais nom de dossier (autorisés : "DOSSIER CLIENT" ou OPXX OPERATION MACHINE TEXTE LIBRE MAJUSCULE).'); // On remonte l'erreur
        } else { // Sinon (si c'est un fichier)
          markFalse(item, ' Fichier interdit dans un dossier de référence pièce / indice.'); // On remonte l'erreur
        }
        break;

      case 2: // NIVEAU 2 - Sous un dossier Ref : soit dossier DT, soit dossier INSTRUCTIONS / Sous un DOSSIER CLIENT : Plan client / Plan contrôle
        let parentName = item.path.substring(getCharPositionInString(item.path, '\\', 2), getCharPositionInString(item.path, '\\', 3) - 1); // On récupère le nom du parent
        // Si le parent est le dossier client ET Le fichier a le nom codifié du plan client (REF[8] PLAN CLIENT.pdf)
        if (parentName === clientFolderName && item.path.substring(getCharPositionInString(item.path, '\\', 1), getCharPositionInString(item.path, '\\', 1) + 8) + clientDrawingSuffix === item.name) {
          item.role = "clientDrawing"; // Affectation du role
        } // Si le parent est le dossier client ET Le fichier a le nom codifié du plan controle (REF[8] PLAN CONTROLE.pdf)
        else if (parentName === clientFolderName && item.path.substring(getCharPositionInString(item.path, '\\', 1), getCharPositionInString(item.path, '\\', 1) + 8) + controlDrawingSuffix === item.name) {
          item.role = "controlDrawing"; // Affectation du role
        } else if (parentName === clientFolderName) { // Si le parent est le dossier client et que c'est un autre fichier ou dossier interdit.
          markFalse(item, "Objet interdit dans le dossier client (Uniquement Plan Client et Plan Contrôle).");
        } else if (parentName.match(opFolderRegex) && item.name === technicalDataFolderName) { // Si le parent est un dossier d'OP et que le dossier est le dossier technique
          item.role = "technicalDataFolder"; // Affectation du role
          let refNumber = item.path.substring(getCharPositionInString(item.path, '\\', 1), getCharPositionInString(item.path, '\\', 1) + 8); // Récupération de la référence pièce
          let opString = item.path.substring(getCharPositionInString(item.path, '\\', 2), getCharPositionInString(item.path, '\\', 3) - 1); // Récupération du nom de l'OP
          let phaseDrawingPresence = false; // Début du check de la présence des enfants obligatoires : fichier Plan de phase
          let manufacturingDrawingPresence = false; // Début du check de la présence des enfants obligatoires : fichier Gamme de fabrication
          let controlProcedurePresence = false; // Début du check de la présence des enfants obligatoires : fichier Gamme de controle
          item.content.forEach((subItem) => {
            if (subItem.type === "file" && subItem.name === refNumber + " PLAN " + opString + ".pdf") { // Si on trouve le dossier DT
              phaseDrawingPresence = true; // Présence OK
            }
            if (subItem.type === "file" && subItem.name === refNumber + " GAMME " + opString + ".pdf") { // Si on trouve le dossier DT
              manufacturingDrawingPresence = true; // Présence OK
            }
            if (subItem.type === "file" && subItem.name === refNumber + " CONTROLE " + opString + ".pdf") { // Si on trouve le dossier DT
              controlProcedurePresence = true; // Présence OK
            }
          });
          if (!phaseDrawingPresence) { // Si pas de fichier Plan de phase
            markFalse(item, ' Plan de phase non présent.'); // On remonte l'erreur
          }
          if (!manufacturingDrawingPresence) { // Si pas de fichier Gamme de fabrication
            markFalse(item, ' Gamme de fabrication non présente.'); // On remonte l'erreur
          }
          if (!controlProcedurePresence) { // Si pas de fichier Gamme de controle
            markFalse(item, ' Gamme de contrôle non présente.'); // On remonte l'erreur
          }
        } else if (parentName.match(opFolderRegex) && item.name === instructionsFolderName) { // Si le parent est un dossier d'OP et que le dossier est le dossier d'instructions
          item.role = "instructionsFolder";
          // Vérification des dossiers présents, et erreur s'il en manque
          let presenceCount = 0;
          let missingFolder = [...instructionFoldersList];
          item.content.forEach((subItem) => {
            missingFolder.forEach((insFold, i) => {
              if (subItem.name === insFold) {
                missingFolder.splice(i, 1);
              }
            });
          });
          if (missingFolder.length) {
            markFalse(item, "Dossier(s) d'instruction manquant : " + missingFolder.toString());
          }
        } else { // Reste des cas
          markFalse(item, "Type d'objet interdit à ce niveau.");
        }
        break;

      case 3: // NIVEAU 3 - Sous le dossier DT : Plan, Gamme, ou Controle / Sous le dossier INSTRUCTIONS : dossier parmi la liste des instructions

        let thirdLevelParentName = item.path.substring(getCharPositionInString(item.path, '\\', 3), getCharPositionInString(item.path, '\\', 4) - 1); // On récupère le nom du parent (DT ou INSTRUCTIONS)
        let thirdLevelRefNumber = item.path.substring(getCharPositionInString(item.path, '\\', 1), getCharPositionInString(item.path, '\\', 1) + 8); // Récupération de la référence pièce
        let thirdLevelOpString = item.path.substring(getCharPositionInString(item.path, '\\', 2), getCharPositionInString(item.path, '\\', 3) - 1); // Récupération du nom de l'OP
        if (thirdLevelParentName === technicalDataFolderName) { // Si on est dans le dossier données techniques
          if (item.name === thirdLevelRefNumber + " PLAN " + thirdLevelOpString + ".pdf") { // Si plan de phase
            item.role = "phaseDrawing";
          } else if (item.name === thirdLevelRefNumber + " GAMME " + thirdLevelOpString + ".pdf") { // Si gamme de fabrication
            item.role = "manufacturingDrawing";
          } else if (item.name === thirdLevelRefNumber + " CONTROLE " + thirdLevelOpString + ".pdf") { // Si gamme de contrôle
            item.role = "controleProcedure";
          } else { // Sinon
            markFalse(item, "Objet interdit dans le dossier technique (uniquement plan, gamme et controle).");
          }
        } else if (thirdLevelParentName === instructionsFolderName) { // Si le parent est le dossier INSTRUCTIONS
          if (instructionFoldersList.includes(item.name)) { // Si le dossier a un nom figurant parmi la liste des dossiers autorisés
            item.role = item.name + "-instructionFolder" // On affecte le rôle correspondant
          } else {
            markFalse(item, "Objet interdit dans le dossier des instructions (uniquement les dossiers suivant : " + instructionFoldersList.toString() + ")"); // Sinon erreur en précisant les dossiers autorisés
          }
        } else {
          markFalse(item, "Objet interdit à ce niveau."); // Sinon erreur générique
        }

        break;

      case 4: // NIVEAU 4 - Instructions
        let fourthLevelParentName = item.path.substring(getCharPositionInString(item.path, '\\', 4), getCharPositionInString(item.path, '\\', 5) - 1); // On récupère le nom du parent (Dossier d'instruction d'un service)
        if (instructionFoldersList.includes(fourthLevelParentName)) { // Si le parent est un dossier d'instructions de service
          if (item.type === "link" && item.fileType === "pdf") { // on vérifie que c'est un lien, et vers un fichier du bon type
            item.role = fourthLevelParentName + "-instruction"; // on le catégorise comme instruction du service
          } else {
            markFalse(item, "Objet interdit à ce niveau (uniquement des RACCOURCIS vers des instructions au format pdf).", "PROD"); // Sinon on remonte le défaut
          }
        } else {
          markFalse(item, "Objet interdit à ce niveau.");
        }
        break;

      default:
        let defaultFourthLevelParentName = item.path.substring(getCharPositionInString(item.path, '\\', 4), getCharPositionInString(item.path, '\\', 5) - 1); // On récupère le nom du parent (Dossier d'instruction d'un service)
        if (instructionFoldersList.includes(fourthLevelParentName)) { // Si le parent est un dossier d'instructions de service
          markFalse(item, "Objet interdit à ce niveau.", "PROD");
        }
        markFalse(item, "Objet interdit à ce niveau.");
    }

  });

}

/*
  FONCTION DE CREATION DE L'ARBRE DES DOSSIERS
  Fonction récursive de création d'un niveau de l'arborescence des Dossiers
  @jsonFolderTree contient l'arborescence locale (premier appel : dossier racine, second appel : dossiers par ref, ...)
  @container est le contenant HTML, que l'on passe pour les appels récursifs
  @relativeParentPath est le chemin du dossier parent (racine : "Dossier Racine")
  @depth est la profondeur du contenant au moment de l'appel
  @absoluteParentPath est le chemin absolu
*/
function createFolderTreeHtml(jsonFolderTree, container, relativeParentPath, depth, absoluteParentPath) {

  // On trie le contenant pour afficher les fichiers en premier et le tout par ordre alphabétique (l'attribut displayOrder dépend du type et permet de les prioriser)
  let cont = jsonFolderTree;
  cont.sort((a, b) => (a.type !== b.type ? (a.displayOrder < b.displayOrder ? -1 : 1) : (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)));

  // Appel de la fonction d'analyse pour catégoriser chaque élément contenu et trouver son rôle
  analyseFolderTree(cont, depth, relativeParentPath, absoluteParentPath);

  let $c = container;
  $c.append('<ul></ul>'); // Création d'un <ul> pour le container
  let $ul = $c.find('>ul').last(); // Récupération de l'élément
  let childrenConf = true; // Initialisation de la conformité des enfants
  let childrenNb = 0; // Initialisation du compte du nombre d'enfants
  jsonFolderTree.forEach((item) => { // On boucle sur le contenu catégorisé préalablement
    childrenNb++;
    if (!item.conf) {
      childrenConf = false;
    }
    if (item.type === "file") {
      appendFile(item, $ul); // Dans le cas "fichier", on appelle la fonction d'insertion d'un élément HTML fichier
    } else if (item.type === "link") {
      appendLink(item, $ul); // Dans le cas "raccourci", on appelle la fonction d'insertion d'un élément HTML raccourci
    } else {
      appendFolder(item, $ul, item.path, depth + 1, item.absolutePath); // Dans le cas "dossier", on appelle la fonction d'insertion d'un élément HTML dossier. Pour l'appel récursif, on donne le chemin @path et la profondeur @depth
      if (!item.children.conf) {
        childrenConf = false;
      }
    }
  });
  // On renvoie la conformité et le nombre d'enfants
  return {
    nb: childrenNb,
    conf: childrenConf
  };
}

/*
  FONCTION DE CREATION DE L'HTML FICHIER
*/
function appendFile(file, $ul) {
  //$ul.append('<li><span class="file-span" data-path="' + file.path + '" data-conf="' + file.conf + '">' + file.name + file.err + '</span></li>');
  $ul.append('<li><span class="file-span">' + file.name + '</span></li>');
  $ul.find('span.file-span').last().data(file);
}

/*
  FONCTION DE CREATION DE L'HTML RACCOURCI
*/
function appendLink(link, $ul) {
  //$ul.append('<li><span class="link-span" data-path="' + link.path + '" data-conf="' + link.conf + '">' + link.name.substring(0, link.name.length - 4) + link.err + '</span></li>');
  $ul.append('<li><span class="link-span">' + link.name.substring(0, link.name.length - 4) + '</span></li>');
  $ul.find('span.link-span').last().data(link);
  checkShortcutLocation(link, $ul.find('span.link-span').last())
}

/*
  FONCTION DE CREATION DE L'HTML DOSSIER
  On remplit le <li> avec le nom du dossier et un contenant <ul> pour son contenu
*/
function appendFolder(folder, $ul, path, depth, absoluteParentPath) {
  //$ul.append('<li><span class="folder-span" data-path="' + folder.path + '" data-conf="' + folder.conf + '">' + folder.name + folder.err + '</span><ul></ul></li>');
  $ul.append('<li><span class="folder-span">' + folder.name + '</span><ul' + ((depth > 0) ? ' hidden' : '') + '></ul></li>'); // Enfants des dossiers cachés par défaut
  let $curLastSpan = $ul.find('span.folder-span').last();
  let $subContainer = $ul.find('>li>ul').last();
  $curLastSpan.on('click', (e) => { // Affichage/masquage au clic sur un dossier
    $subContainer.toggle();
  });
  folder.children = createFolderTreeHtml(folder.content, $subContainer, path, depth, absoluteParentPath); // Appel récursif pour création du niveau correspondant au contenu du dossier inséré
  $curLastSpan.data(folder);
}

/**
 * @method FONCTION DE MARQUAGE DE LA NON CONFORMITE D'UN ELEMENT
 *
 * @param {object} item L'élément de l'arborescence à marquer
 * @param {string} err Le message d'erreur à affecter
 */
function markFalse(item, err, resp) {
  item.conf = false; // Marquage de la non-conformité
  item.err += err;
  $('#error-log>table tbody').append('<tr><td>' + item.err + '</td><td>' + item.absolutePath + '</td><td>' + (resp ? resp : 'METHODES') + '</td></tr>');
  if (!err) {
    console.log('Pas de message d\'erreur pour l\'item "' + item.absolutePath + '".');
  }
}

/**
 * @method FONCTION DE RECUPERATION DE LA N-IEME POSITION D'UN CARACTERE DANS UNE CHAINE
 *
 * @param {string} string La chaîne de caractère dans laquelle rechercher
 * @param {string} subString Le caractère ou la chaîne de caractère à trouver
 * @param {number} index L'index de l'occurence que l'on recherche
 *
 * @return {number} l'indice de la n-ième occurence
 */
function getCharPositionInString(string, subString, index) {
  return string.split(subString, index).join(subString).length + 1;
}

// Méthode d'analyse des raccourcis
function checkShortcutLocation(linkItem, $elt) {
  // Requête pour récupérer le contenu brut du dossier à analyser
  let checkLinkRequest = {
    "url": "/linktest?path=" + linkItem.absolutePath,
    "method": "GET",
    "timeout": 0,
  };

  $.ajax(checkLinkRequest).done(function(response) {
    jsonRes = JSON.parse(response);
    if (!jsonRes.exists) {
      table.row.add(["Fichier inexistant", jsonRes.target, (linkItem.role ? linkItem.role.substring(0, getCharPositionInString(linkItem.role, "-", 1) - 1) : '')]);
      table.draw();
      linkItem.err = "Raccourci pointant vers un fichier inexistant";
      linkItem.conf = false;
    } else if (linkItem.role && instructionFoldersMapping[linkItem.role.substring(0, getCharPositionInString(linkItem.role, "-", 1) - 1)].path) {
      if (!jsonRes.target.includes(instructionFoldersMapping[linkItem.role.substring(0, getCharPositionInString(linkItem.role, "-", 1) - 1)].path)) {
        table.row.add(["Raccourci pointant vers un dossier interdit", linkItem.absolutePath, "PROD"]);
        table.draw();
        linkItem.err = "Raccourci pointant vers un dossier interdit";
        linkItem.conf = false;
      }
    }
    $elt.data(linkItem);
    renderStyle();
  });
}

function renderStyle() {
  $("span").each(function(index) {
    if ($(this).data().conf === false) {
      $(this).css('color', 'red');
      $(this).attr('title', $(this).data().err);
    } else if ($(this).data().children && !$(this).data().children.conf) {
      $(this).css('color', 'orange');
    }
  });
}
