// config table-pager

const pager_config = {
    name: 'crud-table-pager',
    lines: 5,
    steps: [1, 2, 5, 10, 20, 50],
    width: '350px'
}

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

let genericTablePager = document.querySelector('table-pager');

genericTablePager.setAttribute('pager_config', JSON.stringify(pager_config))
genericTablePager.setAttribute('table_config', JSON.stringify(table_config));
genericTablePager.setAttribute('pager_data', JSON.stringify(myData))


const sortStore = [];

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



function arrayRemove(arr, value) {
    return arr.filter(function (ele, i) {
        return i !== value;
    });
}



