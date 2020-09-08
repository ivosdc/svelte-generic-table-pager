# svelte-generic-table-pager

With Version 0.2.0 <table-pager> integrates <crud-table>.
Depending on the need of the `svelte component` in actual development project  I will fix the web component-Example ASAP.
 

- Web-component: `<table-pager></table-pager>`
- or Svelte-component: `import GenericTablePager from 'svelte-generic-table-pager'`

A self-containing paginator for Object-Arrays. Fits to <crud-table></crud-table>

[Try out live example:](https://ivosdc.github.io/svelte-generic-table-pager/ "GeneralCrudTable Example")


## Install

```
npm install svelte-generic-table-pager
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
    <link rel='stylesheet' href='https://ivosdc.github.io/svelte-generic-table-pager/global.css'>
    <link rel='stylesheet' href='https://ivosdc.github.io/svelte-generic-table-pager/build/table-pager.css'>
    <script defer src='https://ivosdc.github.io/svelte-generic-table-pager/build/table-pager.js'></script>
</head>

<body>
<hr>
<table-pager></table-pager>
<crud-table></crud-table>
<hr>
</span style="text-align: right"><a href="https://ivolution.one">ivolution.one product - MIT License</a>
<a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=7V5M288MUT7GE&source=url">donate
</a></p>

</body>
<script src='https://ivosdc.github.io/svelte-generic-table-pager/test-data.js'></script>
<script src='https://ivosdc.github.io/svelte-generic-table-pager/table-pager-config-html.js'></script>
<script src='https://ivosdc.github.io/svelte-generic-table-pager/crud-table-config-html.js'></script>
</template>
</custom-element-demo>
```

```html
<table-pager></table-pager>
```

###  Svelte-Component:
```
<script>
    import SvelteGenericCrudTable from 'svelte-generic-crud-table'
    import GenericTablePager from 'svelte-generic-table-pager'


    function handleDelete(event) {
        const id = event.detail.id; // position in myObjectArray
        const body = event.detail.body; // object to delete
        console.log(JSON.stringify(event.detail.body));
        myObjectArray.slice(id,1);
    }

    function handleUpdate(event) {
        const id = event.detail.id; // position in table
        const body = event.detail.body;
        console.log(JSON.stringify(body));
        myObjectArray[id] = body;
    }

    function handleCreate(event) {
        console.log(JSON.stringify(event.detail)); // empty object is passed by now
        myObjectArray.push({id: -1, name:'new Element', sthg:'2345', why:'1234'})
        const copy = myObjectArray;
        myObjectArray = [];
        myObjectArray = copy;
    }

    function handleDetails(event) {
        const id = event.detail.id; // position in table
        const body = event.detail.body;
        console.log(JSON.stringify(body));
    }


    function handleSort(e) {
        console.log(e);
    }

    let myObjectArray = [
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_12", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_13", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_14", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_15", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_16", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_17", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_18", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_19", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_12345", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 1, name: "A_NAME_1", sthg: "A_STHG_1", why: "because"},
        {id: 2, name: "A_NAME_2", sthg: "A_STHG_2", why: "I can"}
    ];


</script>

<main>
    <GenericTablePager on:delete={handleDelete}
                       on:update={handleUpdate}
                       on:create={handleCreate}
                       on:details={handleDetails}
                       on:sort={handleSort}
                       table_config={{
                           name: 'Awesome:',
                           options: ['CREATE', 'EDIT', 'DELETE', 'DETAILS'],
                           columns_setting: [
                               {name: 'id', show: false, edit: true, size: '200px'},
                               {name: 'name', show: true, edit: true, size: '200px'},
                               {name: 'why', show: true, edit: true, size: '200px'},
                               {name: 'sthg', show: true, edit: false, size: '200px'}
                           ]
                       }}
                       pager_data={myObjectArray}
                       pager_config={{
                                    name: 'crud-table-pager',
                                    lines: 5,
                                    steps: [1, 2, 5, 10, 20, 50],
                                    width: '600px'
                                    }}/></GenericTablePager>
</main>
```