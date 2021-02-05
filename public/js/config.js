// Gestion de l'ajout/suppression des références à scanner

$(function() {
  let configList = [];
  displayConfigList();
  $('#add-ref-btn').on('click', () => {
    addRef();
  });
  $('#add-ref-input').on("keyup", function(event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      addRef();
    }
  });
});

function displayConfigList() {

  $('#config-list-table tbody').empty();

  let configContentRequest = {
    "url": "/configlist",
    "method": "GET",
    "timeout": 0,
  };

  $.ajax(configContentRequest).done(function(configContent) {
    configList = JSON.parse(configContent);
    configList.forEach((item) => {
      $('#config-list-table').append('<tr><td>' + item + '</td><td><button id="btn-' + item + '" class="delete-ref-btn">Supprimer</button></td></tr>');
    });

    $('.delete-ref-btn').on('click', e => {
      let eltToDelete = $(e.target).attr('id').substring(4, $(e.target).attr('id').length);
      let index = 1;
      while (index > -1) {
        index = configList.indexOf(Number(eltToDelete));
        if (index > -1) {
          configList.splice(index, 1);
        }
      }
      saveList(configList);
    });

    $('#config-list-table').DataTable();
  });
}

function addRef() {
  let refToAdd = Number($('#add-ref-input').val());
  if (!configList.includes(refToAdd) && $('#add-ref-input').val().match(/[0-9]{8}/)) {
    configList.push(refToAdd);
    saveList(configList);
  }
  $('#add-ref-input').val('');
}

function saveList(list) {
  let updateConfigContentRequest = {
    "url": "/configlist?content=" + JSON.stringify(list),
    "method": "put",
    "timeout": 0,
  };

  $.ajax(updateConfigContentRequest).done(response => {
    displayConfigList();
  });
}
