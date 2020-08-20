// config table-pager

const pager_config = {
    name: 'crud-table-pager',
    lines: 5,
    steps: [1, 2, 5, 10, 20, 50],
    width: '350px'
}

let table_data = [];

let currentPage = 1;
let maxPages = 1;
let genericTablePager = document.querySelector('table-pager');
genericTablePager.setAttribute('pager_config', JSON.stringify(pager_config))
genericTablePager.setAttribute('pager_data', JSON.stringify(myData))



//config crud-table
let table_config = {
    name: 'Awesome',
    options: ['CREATE', 'EDIT', 'DELETE', 'DETAILS'],
    columns_setting: [
        {name: 'id', show: false, edit: true, size: '200px'},
        {name: 'job', show: true, edit: true, size: '200px'},
        {name: 'name', show: true, edit: true, size: '200px'},
        {name: 'private', show: true, edit: false, size: '200px'}
    ]
}

const sortStore = [];

genericTablePager.setAttribute('table_config', JSON.stringify(table_config));
genericTablePager.setAttribute('table_data', JSON.stringify(table_data));

genericTablePager.addEventListener('create', () => {
    console.log('create');
    myData.push({name: 'myName', job: 'code', private: 'not editable'});
});

genericTablePager.addEventListener('details', (e) => {
    console.log('details');
    console.log(e.detail.body);
});

genericTablePager.addEventListener('update', (e) => {
    console.log('update');
    console.log(e.detail.body);
    let BreakException = {};
    for(let i = 0; i < myData.length; i++) {
        if (JSON.stringify(myData[i]) === JSON.stringify(table_data[e.detail.id])) {
            myData[i] = e.detail.body;
            break;
        }
    }
});

genericTablePager.addEventListener('delete', (e) => {
    console.log('delete: ' + JSON.stringify(e.detail.body));
    console.log('offset in view:' + e.detail.id);
    for(let i = 0; i < myData.length; i++) {
        if (JSON.stringify(myData[i]) === JSON.stringify(table_data[e.detail.id])) {
            myData = arrayRemove(myData, i)
            break;
        }
    }
});

genericTablePager.addEventListener('sort', (e) => {
    console.log('sort: ' + e.detail.column);
    const column = e.detail.column;
    if (sortStore[column] === undefined || sortStore[column] === 'DESC') {
        sortStore[column] = 'ASC';
    } else {
        sortStore[column] = 'DESC';
    }

    const tableSort = (a, b) => {
        var keyA = a[column];
        var keyB = b[column];
        if (sortStore[column] === 'ASC') {
            if (keyA < keyB) return -1;
            if (keyA > keyB) return 1;
        } else {
            if (keyA < keyB) return 1;
            if (keyA > keyB) return -1;
        }
        return 0;
    };

    table_data = table_data.sort(tableSort);
});

function arrayRemove(arr, value) {
    return arr.filter(function (ele, i) {
        return i !== value;
    });
}



