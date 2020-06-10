# svelte-generic-table-pager
- Web-component: `<table-pager></table-pager>` (work in progress...)
- or Svelte-component: `import GenericTablePager from 'svelte-generic-table-pager'` (functional PoC)

A self-containing paginator for Object-Arrays. Fits to <crud-table></crud-table>

[Try out live example:](https://ivosdc.github.io/svelte-generic-table-pager/ "GeneralCrudTable Example")


## Install

```
npm install -save svelte-generic-table-pager
```

[![Donate](https://github.com/ivosdc/svelte-generic-crud-table/raw/master/assets/donate.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=7V5M288MUT7GE&source=url)


# Usage
Use the svelte-generic-crud-table in your component to show and, if you like, edit,update and delete it's content.
Just include the table as seen in the example below.

The svelte-generic-table-pager prepares the incoming data into pages which might be displayed in any table component.

### `<table-pager></table-pager>`
```
<custom-element-demo>
<template>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,initial-scale=1'>
    <title>Generic Crud Table</title>
    <link rel='icon' type='image/png' href='favicon.png'>
    <link rel='stylesheet' href='https://ivosdc.github.io/svelte-generic-crud-table/build/crud-table.css'>
    <script defer src='https://ivosdc.github.io/svelte-generic-crud-table/build/crud-table.js'></script>
    <link rel='stylesheet' href='https://ivosdc.github.io/svelte-generic-table-pager/build/table-pager.css'>
    <script defer src='https://ivosdc.github.io/svelte-generic-table-pager/build/table-pager.js'></script>
</head>

<body>
<hr>
<crud-table></crud-table>
<table-pager></table-pager>
<hr>
</body>

<script>

    // config table-pager
    let table_data = [];
    let myData = [
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName', job: 'code', private: 'not editable'},
        {id: '127', name: 'myName2', job: 'code2', private: 'not editable'}
    ];

    const pager_config = {
        lines: 10
    }
    let genericTablePager = document.querySelector('table-pager');
    genericTablePager.setAttribute('pager_config', JSON.stringify(pager_config))
    genericTablePager.setAttribute('pager_data', JSON.stringify(myData))


    genericTablePager.addEventListener('newpage', (e) => {
        console.log('newpage');
        console.log(e);
        console.log(e.detail);
        table_data = e.detail;
        refresh();
    });

    function refresh_pager() {
        genericTablePager.setAttribute('pager_data', JSON.stringify({}));
        genericTablePager.setAttribute('pager_data', JSON.stringify(myData));
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

    let genericCrudTable = document.querySelector('crud-table');
    const sortStore = [];

    genericCrudTable.setAttribute('table_config', JSON.stringify(table_config));
    genericCrudTable.setAttribute('table_data', JSON.stringify(table_data));

    genericCrudTable.addEventListener('create', () => {
        console.log('create');
        myData.push({name: 'myName', job: 'code', private: 'not editable'});
        refresh_pager();
        refresh();
    });

   genericCrudTable.addEventListener('details', (e) => {
        console.log('details');
        console.log(e.detail.body);
    });

    genericCrudTable.addEventListener('update', (e) => {
        console.log('update');
        console.log(e.detail.body);
        table_data[e.detail.id] = e.detail.body;
        //back to myData an pos page + id
        refresh();
    });

    genericCrudTable.addEventListener('delete', (e) => {
        console.log('delete: ' + JSON.stringify(e.detail.body));
        console.log('offset in view:' + e.detail.id);
        table_data = arrayRemove(table_data, e.detail.id);
        refresh();
    });

    genericCrudTable.addEventListener('sort', (e) => {
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
        refresh();
    });

    function refresh() {
        genericCrudTable.setAttribute('table_data', JSON.stringify({}));
        genericCrudTable.setAttribute('table_data', JSON.stringify(table_data));
    }

    function arrayRemove(arr, value) {
        return arr.filter(function (ele, i) {
            return i !== value;
        });
    }
</script>
</template>
</custom-element-demo>
```

```html
<crud-table></crud-table>
<table-pager></table-pager>
```

###  Svelte-Component:
```
<script>
    import SvelteGenericTablePager from "svelte-generic-table-pager";

    function handleNewPage(event) {
    }

    // example object array. This should be your db query result.
    const myObjectArray = [
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 2, name: "A_NAME_2", sthg: "A_STHG_2", why: "I can"}
    ]
</script>

<main>
    <SvelteGenericTablePager on:newpage={handleNewPage}
                              table_config={{
                                lines: 10
                            }}
                            table_data={JSON.stringify(myObjectArray)}></SvelteGenericCrudTable>
</main>
```
